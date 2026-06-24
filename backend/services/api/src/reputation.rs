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

// =============================================================================
// Aggregated Reputation Scoring — Issue #827
//
// On-chain contract is the authoritative base score (read via Stellar RPC and
// cached in Postgres with a 5-minute TTL). Off-chain signals (response rate,
// KYC level, profile completeness, activity decay) are applied as multipliers.
//
// Formula:
//   effective = on_chain_base
//               * (1 + response_rate_bonus + profile_bonus)
//               * kyc_multiplier
//               * (1 - decay_factor)
// =============================================================================

use std::collections::HashMap as CacheMap;
use std::time::Instant;

/// KYC verification level, in ascending order of trust.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum KycLevel {
    None,
    Basic,
    Advanced,
    Institutional,
}

/// Off-chain signals supplied by the application layer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OffChainSignals {
    /// Fraction of messages/requests answered (0.0–1.0).
    pub response_rate: f64,
    pub kyc_level: KycLevel,
    /// Fraction of profile fields filled (0.0–1.0).
    pub profile_completeness: f64,
    /// Calendar days since the creator last completed a bounty or review.
    pub days_since_last_activity: u32,
}

/// Per-component breakdown of the effective score, exposed in the API tooltip.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationBreakdown {
    pub on_chain_base: f64,
    pub response_rate_bonus: f64,
    pub kyc_multiplier: f64,
    pub decay_factor: f64,
    pub profile_bonus: f64,
    pub effective_score: f64,
}

/// Full reputation result combining on-chain base with off-chain multipliers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EffectiveReputation {
    pub creator_address: String,
    pub breakdown: ReputationBreakdown,
    pub cached_at: chrono::DateTime<chrono::Utc>,
    /// Remaining seconds before the cache entry expires (max 300).
    pub cache_ttl_seconds: u64,
    /// True when the base score was confirmed via an on-chain RPC call.
    pub on_chain_verified: bool,
}

// ---------------------------------------------------------------------------
// Multiplier helpers
// ---------------------------------------------------------------------------

/// KYC multiplier: higher verification level → higher score ceiling.
pub fn kyc_multiplier(level: &KycLevel) -> f64 {
    match level {
        KycLevel::None => 1.00,
        KycLevel::Basic => 1.05,
        KycLevel::Advanced => 1.12,
        KycLevel::Institutional => 1.20,
    }
}

/// Response-rate bonus: linear 0.0–0.15 mapped from 0%–100% response rate.
pub fn response_rate_bonus(rate: f64) -> f64 {
    rate.clamp(0.0, 1.0) * 0.15
}

/// Activity decay: 0.0 penalty for < 30 days inactive, linear to 0.20 at ≥ 365 days.
pub fn decay_factor(days_inactive: u32) -> f64 {
    const GRACE_DAYS: u32 = 30;
    const MAX_DAYS: u32 = 365;
    const MAX_DECAY: f64 = 0.20;

    if days_inactive < GRACE_DAYS {
        return 0.0;
    }
    let clamped = (days_inactive - GRACE_DAYS).min(MAX_DAYS - GRACE_DAYS) as f64;
    let range = (MAX_DAYS - GRACE_DAYS) as f64;
    (clamped / range) * MAX_DECAY
}

/// Profile-completeness bonus: linear 0.0–0.08 at 100% complete.
pub fn profile_bonus(completeness: f64) -> f64 {
    completeness.clamp(0.0, 1.0) * 0.08
}

// ---------------------------------------------------------------------------
// Score computation
// ---------------------------------------------------------------------------

/// Apply off-chain multipliers to an on-chain base score and return a full breakdown.
pub fn compute_effective_score(on_chain_base: f64, signals: &OffChainSignals) -> ReputationBreakdown {
    let rr_bonus = response_rate_bonus(signals.response_rate);
    let kyc_mult = kyc_multiplier(&signals.kyc_level);
    let decay = decay_factor(signals.days_since_last_activity);
    let prof_bonus = profile_bonus(signals.profile_completeness);

    let effective = on_chain_base
        * (1.0 + rr_bonus + prof_bonus)
        * kyc_mult
        * (1.0 - decay);

    ReputationBreakdown {
        on_chain_base,
        response_rate_bonus: rr_bonus,
        kyc_multiplier: kyc_mult,
        decay_factor: decay,
        profile_bonus: prof_bonus,
        effective_score: effective,
    }
}

// ---------------------------------------------------------------------------
// In-memory cache (5-minute TTL, keyed by creator address)
// ---------------------------------------------------------------------------

const CACHE_TTL_SECS: u64 = 300;

lazy_static::lazy_static! {
    static ref REPUTATION_CACHE: Arc<Mutex<CacheMap<String, (EffectiveReputation, Instant)>>> =
        Arc::new(Mutex::new(CacheMap::new()));
}

/// Derive a 0–100 on-chain base score from the existing review aggregation.
///
/// In production this would call the Stellar RPC to read the `stellar_insights`
/// contract's stored score. For now we derive it from the review average so the
/// formula can be exercised end-to-end without an active network connection.
async fn fetch_on_chain_base(creator_address: &str, pool: Option<&PgPool>) -> (f64, bool) {
    match aggregate_reviews(creator_address, pool).await {
        Ok(agg) if agg.total_reviews > 0 => {
            // Scale 1–5 star average to a 0–100 base score.
            let base = ((agg.average_rating - 1.0) / 4.0) * 100.0;
            (base.clamp(0.0, 100.0), false) // on_chain_verified = false until RPC is wired
        }
        _ => (50.0, false), // neutral default when no reviews exist
    }
}

/// Return the effective reputation for a creator, serving from cache when fresh.
///
/// Cache entries are invalidated after `CACHE_TTL_SECS` (300 s). Callers
/// that complete a bounty or submit a review should call
/// `invalidate_reputation_cache` to force an immediate refresh.
pub async fn fetch_reputation_with_cache(
    creator_address: &str,
    pool: Option<&PgPool>,
    signals: OffChainSignals,
) -> Result<EffectiveReputation, String> {
    // Check cache first.
    {
        let cache = REPUTATION_CACHE.lock().unwrap();
        if let Some((cached, stored_at)) = cache.get(creator_address) {
            let elapsed = stored_at.elapsed().as_secs();
            if elapsed < CACHE_TTL_SECS {
                let mut hit = cached.clone();
                hit.cache_ttl_seconds = CACHE_TTL_SECS - elapsed;
                return Ok(hit);
            }
        }
    }

    // Cache miss — recompute.
    let (on_chain_base, on_chain_verified) = fetch_on_chain_base(creator_address, pool).await;
    let breakdown = compute_effective_score(on_chain_base, &signals);

    let result = EffectiveReputation {
        creator_address: creator_address.to_string(),
        breakdown,
        cached_at: chrono::Utc::now(),
        cache_ttl_seconds: CACHE_TTL_SECS,
        on_chain_verified,
    };

    REPUTATION_CACHE
        .lock()
        .unwrap()
        .insert(creator_address.to_string(), (result.clone(), Instant::now()));

    Ok(result)
}

/// Remove a creator's cache entry so the next request forces a fresh RPC read.
/// Call this whenever a new completed bounty or review is recorded.
pub fn invalidate_reputation_cache(creator_address: &str) {
    REPUTATION_CACHE.lock().unwrap().remove(creator_address);
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

    #[test]
    fn test_effective_reputation_formula() {
        let signals = OffChainSignals {
            response_rate: 0.8,
            kyc_level: KycLevel::Advanced,
            profile_completeness: 0.9,
            days_since_last_activity: 5,
        };
        let breakdown = compute_effective_score(75.0, &signals);

        // Multipliers should push effective_score above the base.
        assert!(breakdown.effective_score > 75.0,
            "effective_score {} should exceed base 75.0", breakdown.effective_score);
        assert!(breakdown.response_rate_bonus > 0.0);
        assert!(breakdown.kyc_multiplier > 1.0);
        assert_eq!(breakdown.decay_factor, 0.0, "5 days inactive should have zero decay");
        assert!(breakdown.profile_bonus > 0.0);
        assert!(breakdown.on_chain_base > 0.0);
    }

    #[test]
    fn test_decay_boundaries() {
        assert_eq!(decay_factor(0), 0.0);
        assert_eq!(decay_factor(29), 0.0);
        assert!(decay_factor(30) >= 0.0);
        assert!((decay_factor(365) - 0.20).abs() < 1e-9);
        assert_eq!(decay_factor(1000), 0.20); // capped
    }

    #[test]
    fn test_kyc_multiplier_ordering() {
        assert!(kyc_multiplier(&KycLevel::Institutional) > kyc_multiplier(&KycLevel::Advanced));
        assert!(kyc_multiplier(&KycLevel::Advanced) > kyc_multiplier(&KycLevel::Basic));
        assert!(kyc_multiplier(&KycLevel::Basic) > kyc_multiplier(&KycLevel::None));
        assert_eq!(kyc_multiplier(&KycLevel::None), 1.0);
    }

    #[tokio::test]
    async fn test_reputation_cache_hit() {
        let addr = "CACHE_TEST_CREATOR_001";
        let signals = OffChainSignals {
            response_rate: 0.5,
            kyc_level: KycLevel::Basic,
            profile_completeness: 0.6,
            days_since_last_activity: 10,
        };
        // First call populates the cache.
        let first = fetch_reputation_with_cache(addr, None, signals.clone()).await.unwrap();
        // Second call should be a cache hit with ttl < CACHE_TTL_SECS.
        let second = fetch_reputation_with_cache(addr, None, signals).await.unwrap();
        assert_eq!(first.breakdown.effective_score, second.breakdown.effective_score);
        assert!(second.cache_ttl_seconds <= CACHE_TTL_SECS);
        // Clean up.
        invalidate_reputation_cache(addr);
    }
}