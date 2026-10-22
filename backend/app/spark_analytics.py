from pyspark.sql import SparkSession, functions as F

REQUIRED_COLUMNS = ["airline", "review", "rating", "date"]
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
    """Read a CSV, clean it, register the 'reviews' SQL view. Returns a cleaning report."""
    spark = get_spark()
    raw = spark.read.option("header", True).option("multiLine", True).csv(path)
    raw = raw.toDF(*[c.strip().lower() for c in raw.columns])

    missing = [c for c in REQUIRED_COLUMNS if c not in raw.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Expected: {REQUIRED_COLUMNS}")

    df = (
        raw.select(*REQUIRED_COLUMNS)
        .withColumn("airline", F.trim("airline"))
        .withColumn("review", F.trim("review"))
        .withColumn("rating", F.col("rating").cast("double"))
        .withColumn("date", F.to_date("date"))
    )
    rows_in = df.count()

    df = df.filter(F.col("review").isNotNull() & (F.col("review") != ""))
    df = df.filter(F.col("airline").isNotNull() & (F.col("airline") != ""))
    # ratings outside 1-10 become NULL (kept as a review, excluded from averages)
    df = df.withColumn(
        "rating", F.when(F.col("rating").between(1, 10), F.col("rating"))
    )
    df = df.dropDuplicates(["airline", "review", "date"])
    df.cache()
    rows_out = df.count()
    df.createOrReplaceTempView("reviews")

    return {
        "rows_in": rows_in,
        "rows_kept": rows_out,
        "rows_removed": rows_in - rows_out,
        "invalid_ratings_nulled": df.filter(F.col("rating").isNull()).count(),
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
}


def run_query(name: str) -> dict:
    q = QUERIES[name]
    rows = [r.asDict() for r in get_spark().sql(q["sql"]).collect()]
    return {"name": name, "purpose": q["purpose"], "sql": q["sql"].strip(), "rows": rows}
    