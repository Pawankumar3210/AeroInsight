from pyspark.sql import SparkSession, functions as F

from .config import MIN_AIRLINE_SAMPLE

REQUIRED_COLUMNS = ["airline", "review", "rating", "date"]
SORTABLE_COLUMNS = {"airline", "rating", "date"}
_spark = None  # created once, reused for every request


def get_spark() -> SparkSession:
    global _spark
    if _spark is None:
        _spark = (
            SparkSession.builder.master("local[2]")
            .appName("AeroInsight")
            .config("spark.sql.shuffle.partitions", "4")
            .config("spark.ui.enabled", "false")
            .getOrCreate()
        )
        _spark.sparkContext.setLogLevel("ERROR")
    return _spark


def load_reviews(path: str) -> dict:
    """Read a CSV, validate and clean it, register the 'reviews' SQL view.

    Raises ValueError for problems the user can fix (bad columns, empty file).
    The existing 'reviews' view is only replaced if everything succeeds.
    """
    spark = get_spark()
    raw = (
        spark.read.option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .csv(path)
    )
    raw = raw.toDF(*[c.strip().strip("\ufeff").strip().lower() for c in raw.columns])

    missing = [c for c in REQUIRED_COLUMNS if c not in raw.columns]
    if missing:
        raise ValueError(
            f"Missing required columns: {missing}. "
            f"Your file has: {raw.columns}. Expected: {REQUIRED_COLUMNS}"
        )

    df = (
        raw.select(*REQUIRED_COLUMNS)
        .withColumn("airline", F.trim("airline"))
        .withColumn("review", F.trim("review"))
        .withColumn("rating", F.col("rating").cast("double"))
        .withColumn("date", F.to_date("date"))  # expects YYYY-MM-DD, otherwise NULL
    )
    rows_in = df.count()
    if rows_in == 0:
        raise ValueError("The file has a header row but no data rows.")

    spark.catalog.clearCache()  # drop the previous dataset from memory

    df = df.filter(F.col("review").isNotNull() & (F.col("review") != ""))
    df = df.filter(F.col("airline").isNotNull() & (F.col("airline") != ""))
    # ratings outside 1-10 become NULL (review kept, excluded from averages)
    df = df.withColumn("rating", F.when(F.col("rating").between(1, 10), F.col("rating")))
    df = df.dropDuplicates(["airline", "review", "date"])
    df.cache()
    rows_out = df.count()
    df.createOrReplaceTempView("reviews")

    return {
        "rows_in": rows_in,
        "rows_kept": rows_out,
        "rows_removed": rows_in - rows_out,
        "invalid_ratings_nulled": df.filter(F.col("rating").isNull()).count(),
        "missing_or_invalid_dates": df.filter(F.col("date").isNull()).count(),
    }


# ---- Spark SQL queries (shown on the "Spark SQL Insights" page later) ----
QUERIES = {
    "reviews_by_airline": {
        "purpose": "Total number of reviews per airline.",
        "sql": """
            SELECT airline, COUNT(*) AS total_reviews
            FROM reviews
            GROUP BY airline
            ORDER BY total_reviews DESC
        """,
    },
    "avg_rating_by_airline": {
        "purpose": "Average passenger rating per airline (NULL ratings ignored).",
        "sql": """
            SELECT airline,
                   ROUND(AVG(rating), 2) AS avg_rating,
                   COUNT(rating) AS rated_reviews
            FROM reviews
            GROUP BY airline
            ORDER BY avg_rating DESC
        """,
    },
    "rating_distribution": {
        "purpose": "How many reviews gave each rating from 1 to 10.",
        "sql": """
            SELECT CAST(rating AS INT) AS rating, COUNT(*) AS reviews
            FROM reviews
            WHERE rating IS NOT NULL
            GROUP BY CAST(rating AS INT)
            ORDER BY rating
        """,
    },
    "monthly_review_trend": {
        "purpose": "Review volume and average rating for each month.",
        "sql": """
            SELECT date_format(date, 'yyyy-MM') AS month,
                   COUNT(*) AS reviews,
                   ROUND(AVG(rating), 2) AS avg_rating
            FROM reviews
            WHERE date IS NOT NULL
            GROUP BY date_format(date, 'yyyy-MM')
            ORDER BY month
        """,
    },
    "complaint_categories": {
        "purpose": (
            "Complaint themes among low-rated reviews (rating 4 or below), found by "
            "keyword matching. One review can count in several categories. This is a "
            "simple keyword method, not a language model."
        ),
        "sql": """
            SELECT * FROM (
                WITH complaints AS (
                    SELECT lower(review) AS text FROM reviews WHERE rating <= 4
                )
                SELECT 'Delays' AS category, COUNT(*) AS mentions
                  FROM complaints WHERE text RLIKE 'delay|cancel|waited|waiting'
                UNION ALL
                SELECT 'Baggage', COUNT(*)
                  FROM complaints WHERE text RLIKE 'bag|luggage|lost'
                UNION ALL
                SELECT 'Customer service', COUNT(*)
                  FROM complaints WHERE text RLIKE 'customer service|rude|unhelpful|staff'
                UNION ALL
                SELECT 'Seating', COUNT(*)
                  FROM complaints WHERE text RLIKE 'seat|legroom|cramped'
                UNION ALL
                SELECT 'Cleanliness', COUNT(*)
                  FROM complaints WHERE text RLIKE 'dirty|clean|smell'
                UNION ALL
                SELECT 'Food', COUNT(*)
                  FROM complaints WHERE text RLIKE 'food|meal|drink'
            )
            ORDER BY mentions DESC
        """,
    },
    "low_rating_share_by_airline": {
        "purpose": (
            f"Share of reviews rated 4 or below, per airline. Airlines with fewer than "
            f"{MIN_AIRLINE_SAMPLE} rated reviews are left out so tiny samples don't "
            f"look dramatic."
        ),
        "sql": f"""
            SELECT airline,
                   COUNT(rating) AS rated_reviews,
                   SUM(CASE WHEN rating <= 4 THEN 1 ELSE 0 END) AS low_rated,
                   ROUND(100.0 * SUM(CASE WHEN rating <= 4 THEN 1 ELSE 0 END)
                         / COUNT(rating), 1) AS low_rating_pct
            FROM reviews
            WHERE rating IS NOT NULL
            GROUP BY airline
            HAVING COUNT(rating) >= {MIN_AIRLINE_SAMPLE}
            ORDER BY low_rating_pct DESC
        """,
    },
}


def run_query(name: str) -> dict:
    q = QUERIES[name]
    rows = [r.asDict() for r in get_spark().sql(q["sql"]).collect()]
    return {
        "name": name,
        "purpose": q["purpose"],
        "sql": q["sql"].strip(),
        "row_count": len(rows),
        "rows": rows,
    }


def search_reviews(search: str, airline: str, sort: str, order: str,
                   limit: int, offset: int) -> dict:
    """Filter, sort and page through reviews (Spark DataFrame API, not SQL)."""
    if sort not in SORTABLE_COLUMNS:
        raise ValueError(f"sort must be one of {sorted(SORTABLE_COLUMNS)}")
    if order not in ("asc", "desc"):
        raise ValueError("order must be 'asc' or 'desc'")

    df = get_spark().table("reviews")
    if airline:
        df = df.filter(F.col("airline") == airline)
    if search:
        df = df.filter(F.lower(F.col("review")).contains(search.lower()))

    total = df.count()
    col = F.col(sort).desc_nulls_last() if order == "desc" else F.col(sort).asc_nulls_last()
    rows = df.orderBy(col, "review").limit(offset + limit).collect()[offset:]
    return {"total": total, "limit": limit, "offset": offset,
            "rows": [r.asDict() for r in rows]}
