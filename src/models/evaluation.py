"""Metrics for the fraud problem. Accuracy is not used."""

import numpy as np
from sklearn.metrics import (average_precision_score, roc_auc_score,
                             precision_recall_curve)


def recall_at_precision(y_true, scores, min_precision):
    """Best recall that keeps precision >= min_precision, and the alerts it costs.

    Returns (recall, alerts_per_10k). alerts_per_10k is the number of transactions
    flagged for every 10,000 scored. Returns (0, 0) if the precision is never reached.
    """
    precision, recall, thresholds = precision_recall_curve(y_true, scores)
    ok = precision[:-1] >= min_precision
    if not ok.any():
        return 0.0, 0.0
    best = np.argmax(np.where(ok, recall[:-1], -1))
    flagged = (scores >= thresholds[best]).mean() * 10_000
    return float(recall[best]), float(flagged)


def evaluate(y_true, scores):
    y_true = np.asarray(y_true)
    scores = np.asarray(scores)

    precision, recall, _ = precision_recall_curve(y_true, scores)
    f1 = 2 * precision * recall / np.clip(precision + recall, 1e-12, None)

    r80, a80 = recall_at_precision(y_true, scores, 0.80)
    r95, a95 = recall_at_precision(y_true, scores, 0.95)
    return {
        'prevalence_pct': round(y_true.mean() * 100, 3),
        'pr_auc': average_precision_score(y_true, scores),
        'roc_auc': roc_auc_score(y_true, scores),
        'best_f1': float(f1.max()),
        'recall_at_p80': r80,
        'recall_at_p95': r95,
        'alerts_per_10k_at_p95': a95,
    }


def bootstrap_pr_auc(y_true, scores, n_boot=100, seed=42):
    """95% interval of the PR-AUC, by resampling the validation rows."""
    rng = np.random.default_rng(seed)
    y_true = np.asarray(y_true)
    scores = np.asarray(scores)
    n = len(y_true)
    values = []
    for _ in range(n_boot):
        idx = rng.integers(0, n, n)
        if y_true[idx].sum() == 0:
            continue
        values.append(average_precision_score(y_true[idx], scores[idx]))
    low, high = np.percentile(values, [2.5, 97.5])
    return float(low), float(high)
