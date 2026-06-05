//! Reputation and review aggregation for creators.
//!
//! Reviews are sourced from database with fallback to in-memory seed list for development.
//! Aggregation computes average rating, totals, per-star counts, and a recent slice.
//! Includes hooks for real-time reputation updates when reviews are submitted.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use sqlx::{PgPool, Error as SqlxError};
use futures::future::BoxFuture;

/// Review from a client or employer about a creator's work
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Review {
    pub id: u64,
    pub creator_address: String,
    pub reviewer_address: String,
    pub bounty_id: Option<u64>,
    pub rating: u8, // 1-5 stars
    pub comment: String,
    pub verified: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Data required to submit a new review
#[derive(Debug, Serialize, Deserialize)]
pub struct ReviewSubmission {
    pub creator_address: String,
    pub reviewer_address: String,
    pub bounty_id: Option<u64>,
    pub rating: u8,
    pub comment: String,
}

/// Aggregated review statistics for a creator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewAggregation {
    pub creator_address: String,
    pub total_reviews: u32,
    pub average_rating: f64,
    pub star_counts: HashMap<u8, u32>, // star_level -> count
    pub recent_reviews: Vec<Review>,
}

/// Event for real-time reputation updates
#[derive(Debug, Serialize, Deserialize)]
pub struct CreatorReputationPayload {
    pub creator_address: String,
    pub new_review: Review,
    pub updated_aggregation: ReviewAggregation,
}

// Global in-memory cache for development/testing
lazy_static::lazy_static! {
    static ref REVIEW_CACHE: Arc<Mutex<Vec<Review>>> = Arc::new(Mutex::new(vec![
        Review {
            id: 1,
            creator_address: "GCAZ6I2VEI2SP4KJDIPFCDR6DZQT5SIWVSQGWXR5G3MVVDYTPNTMHAVY".to_string(),
            reviewer_address: "GABC123REVIEWER456DEF".to_string(),
            bounty_id: Some(101),
            rating: 5,
            comment: "Outstanding work on the DeFi integration. Delivered ahead of schedule.".to_string(),
            verified: true,
            created_at: chrono::Utc::now() - chrono::Duration::days(5),
        },
        Review {
            id: 2,
            creator_address: "GCAZ6I2VEI2SP4KJDIPFCDR6DZQT5SIWVSQGWXR5G3MVVDYTPNTMHAVY".to_string(),
            reviewer_address: "GDEF789REVIEWER012GHI".to_string(),
            bounty_id: Some(102),
            rating: 4,
            comment: "Great communication and solid technical skills. Minor delay but high quality.".to_string(),
            verified: true,
            created_at: chrono::Utc::now() - chrono::Duration::days(12),
        },
        Review {
            id: 3,
            creator_address: "GDAX7I3VEI3SP5KJDIPFCDR7DZQT6TIWVSQGWXR6G4MVVDYTPNTMHBVZ".to_string(),
            reviewer_address: "GHIJ345REVIEWER678KLM".to_string(),
            bounty_id: Some(103),
            rating: 3,
            comment: "Decent work but needed more revisions than expected.".to_string(),
            verified: false,
            created_at: chrono::Utc::now() - chrono::Duration::days(20),
        },
    ]));
}

/// Helper to format database errors consistently
fn format_db_error(err: SqlxError) -> String {
    match err {
        SqlxError::RowNotFound => "Record not found".to_string(),
        SqlxError::Database(db_err) => format!("Database error: {}", db_err),
        _ => format!("Database operation failed: {}", err),
    }
}

/// Get all reviews (development/testing function)
pub fn get_mock_reviews() -> Vec<Review> {
    REVIEW_CACHE.lock().unwrap().clone()
}

/// Get reviews for a specific creator address
pub async fn reviews_for_creator(creator_address: &str, pool: Option<&PgPool>) -> Result<Vec<Review>, String> {
    if let Some(pg_pool) = pool {
        let query = r#"
            SELECT id, creator_address, reviewer_address, bounty_id, rating, comment, verified, created_at
            FROM reviews 
            WHERE creator_address = $1
            ORDER BY created_at DESC
        "#;

        sqlx::query_as::<_, (u64, String, String, Option<u64>, i16, String, bool, chrono::DateTime<chrono::Utc>)>(query)
            .bind(creator_address)
            .fetch_all(pg_pool)
            .await
            .map(|rows| {
                rows.into_iter()
                    .map(|(id, creator_addr, reviewer_addr, bounty_id, rating, comment, verified, created_at)| Review {
                        id,
                        creator_address: creator_addr,
                        reviewer_address: reviewer_addr,
                        bounty_id,
                        rating: rating as u8,
                        comment,
                        verified,
                        created_at,
                    })
                    .collect()
            })
            .map_err(format_db_error)
    } else {
        Ok(REVIEW_CACHE
            .lock()
            .unwrap()
            .iter()
            .filter(|r| r.creator_address == creator_address)
            .cloned()
            .collect())
    }
}

/// Aggregate review statistics for a creator
pub async fn aggregate_reviews(creator_address: &str, pool: Option<&PgPool>) -> Result<ReviewAggregation, String> {
    let reviews = reviews_for_creator(creator_address, pool).await?;

    let total_reviews = reviews.len() as u32;
    let average_rating = if total_reviews > 0 {
        reviews.iter().map(|r| r.rating as f64).sum::<f64>() / total_reviews as f64
    } else {
        0.0
    };

    let mut star_counts = HashMap::new();
    for rating in 1..=5u8 {
        star_counts.insert(rating, reviews.iter().filter(|r| r.rating == rating).count() as u32);
    }

    let recent_reviews = reviews.into_iter().take(3).collect();

    Ok(ReviewAggregation {
        creator_address: creator_address.to_string(),
        total_reviews,
        average_rating,
        star_counts,
        recent_reviews,
    })
}

/// Get recent reviews across all creators (for homepage/feeds)
pub async fn recent_reviews(limit: u32, pool: Option<&PgPool>) -> Result<Vec<Review>, String> {
    if let Some(pg_pool) = pool {
        let query = r#"
            SELECT id, creator_address, reviewer_address, bounty_id, rating, comment, verified, created_at
            FROM reviews 
            ORDER BY created_at DESC
            LIMIT $1
        "#;

        sqlx::query_as::<_, (u64, String, String, Option<u64>, i16, String, bool, chrono::DateTime<chrono::Utc>)>(query)
            .bind(limit as i64)
            .fetch_all(pg_pool)
            .await
            .map(|rows| {
                rows.into_iter()
                    .map(|(id, creator_addr, reviewer_addr, bounty_id, rating, comment, verified, created_at)| Review {
                        id,
                        creator_address: creator_addr,
                        reviewer_address: reviewer_addr,
                        bounty_id,
                        rating: rating as u8,
                        comment,
                        verified,
                        created_at,
                    })
                    .collect()
            })
            .map_err(format_db_error)
    } else {
        let mut reviews = REVIEW_CACHE.lock().unwrap().clone();
        reviews.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        reviews.truncate(limit as usize);
        Ok(reviews)
    }
}

/// Submit a new review
pub async fn submit_review(submission: ReviewSubmission, pool: Option<&PgPool>) -> Result<Review, String> {
    let new_review = Review {
        id: chrono::Utc::now().timestamp() as u64, // Simple ID generation
        creator_address: submission.creator_address,
        reviewer_address: submission.reviewer_address,
        bounty_id: submission.bounty_id,
        rating: submission.rating,
        comment: submission.comment,
        verified: false, // Verification happens separately
        created_at: chrono::Utc::now(),
    };

    if let Some(pg_pool) = pool {
        let query = r#"
            INSERT INTO reviews (id, creator_address, reviewer_address, bounty_id, rating, comment, verified, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, creator_address, reviewer_address, bounty_id, rating, comment, verified, created_at
        "#;

        sqlx::query_as::<_, (u64, String, String, Option<u64>, i16, String, bool, chrono::DateTime<chrono::Utc>)>(query)
            .bind(new_review.id as i64)
            .bind(&new_review.creator_address)
            .bind(&new_review.reviewer_address)
            .bind(new_review.bounty_id.map(|id| id as i64))
            .bind(new_review.rating as i16)
            .bind(&new_review.comment)
            .bind(new_review.verified)
            .bind(new_review.created_at)
            .fetch_one(pg_pool)
            .await
            .map(|(id, creator_addr, reviewer_addr, bounty_id, rating, comment, verified, created_at)| Review {
                id,
                creator_address: creator_addr,
                reviewer_address: reviewer_addr,
                bounty_id: bounty_id.map(|id| id as u64),
                rating: rating as u8,
                comment,
                verified,
                created_at,
            })
            .map_err(format_db_error)
    } else {
        REVIEW_CACHE.lock().unwrap().push(new_review.clone());
        Ok(new_review)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_review_aggregation() {
        let creator_addr = "GCAZ6I2VEI2SP4KJDIPFCDR6DZQT5SIWVSQGWXR5G3MVVDYTPNTMHAVY";
        let aggregation = aggregate_reviews(creator_addr, None).await.unwrap();
        
        assert_eq!(aggregation.creator_address, creator_addr);
        assert!(aggregation.total_reviews >= 2);
        assert!(aggregation.average_rating > 0.0);
        assert!(!aggregation.recent_reviews.is_empty());
    }

    #[tokio::test]
    async fn test_recent_reviews_limit() {
        let reviews = recent_reviews(1, None).await.unwrap();
        assert_eq!(reviews.len(), 1);
    }

    #[tokio::test]
    async fn test_submit_review() {
        let submission = ReviewSubmission {
            creator_address: "TEST_CREATOR".to_string(),
            reviewer_address: "TEST_REVIEWER".to_string(),
            bounty_id: Some(999),
            rating: 4,
            comment: "Test review".to_string(),
        };

        let review = submit_review(submission, None).await.unwrap();
        assert_eq!(review.rating, 4);
        assert_eq!(review.comment, "Test review");
        assert!(!review.verified);
    }
}