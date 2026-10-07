"""Checks that history features only use earlier steps."""

import numpy as np
import pandas as pd

from src.features.feature_pipeline import build_features
from src.features import config


def make_fake_paysim(n=4000, seed=0):
    rng = np.random.default_rng(seed)
    types = rng.choice(config.TRANSACTION_TYPES, size=n)
    old = rng.choice([0, 0, 500, 5000, 90000], size=n).astype(float)
    return pd.DataFrame({
        'step': np.sort(rng.integers(1, 200, size=n)),
        'type': pd.Categorical(types, categories=config.TRANSACTION_TYPES),
        'amount': rng.gamma(2, 3000, size=n).round(2),
        'nameOrig': ['C%d' % x for x in rng.integers(0, 3000, size=n)],
        'oldbalanceOrg': old,
        'oldbalanceDest': rng.choice([0, 1000, 20000], size=n).astype(float),
        'nameDest': ['C%d' % x for x in rng.integers(0, 150, size=n)],
        'isFraud': rng.integers(0, 2, size=n),
    })


def test_matches_slow_reference():
    raw = make_fake_paysim()
    feats = build_features(raw)
    window = config.RECENT_WINDOW
    for i in np.random.default_rng(1).choice(len(raw), 300, replace=False):
        row = raw.iloc[i]
        past = raw[(raw['nameDest'] == row['nameDest']) & (raw['step'] < row['step'])]
        recent = past[past['step'] >= row['step'] - window]
        assert feats['dest_txn_count_before'].iloc[i] == len(past)
        assert feats['dest_unique_origins_before'].iloc[i] == past['nameOrig'].nunique()
        assert feats['dest_txn_count_recent'].iloc[i] == len(recent)
        assert np.isclose(feats['dest_amount_sum_recent'].iloc[i], recent['amount'].sum(), rtol=1e-4)
        expected_last = row['step'] - past['step'].max() if len(past) else -1
        assert feats['dest_steps_since_last'].iloc[i] == expected_last
        opast = raw[(raw['nameOrig'] == row['nameOrig']) & (raw['step'] < row['step'])]
        assert feats['orig_txn_count_before'].iloc[i] == len(opast)


def test_future_rows_do_not_change_past_features():
    raw = make_fake_paysim()
    full = build_features(raw)
    cut = 120
    early = raw[raw['step'] <= cut]
    partial = build_features(early)
    pd.testing.assert_frame_equal(full.loc[early.index], partial, check_exact=False, rtol=1e-5)
