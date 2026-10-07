"""Build the full feature table from the raw PaySim frame."""

import os

import pandas as pd

from . import config
from .transaction_features import add_transaction_features
from .time_features import add_time_features
from .account_features import add_destination_features, add_origin_features


def build_features(raw):
    """Return the engineered features only (same index as raw).

    The target and the leaky balance columns are not used here.
    """
    parts = [
        add_transaction_features(raw),
        add_time_features(raw),
        add_destination_features(raw),
        add_origin_features(raw),
    ]
    feats = pd.concat(parts, axis=1)
    assert len(feats) == len(raw), 'row count changed'
    return feats


def build_model_table(raw):
    """Features + target + a row id that points back to the raw file.

    Account names and post-transaction balances are left out on purpose.
    """
    feats = build_features(raw)
    table = feats.copy()
    table.insert(0, 'row_id', raw.index.to_numpy().astype('int32'))
    table['isFraud'] = raw['isFraud'].to_numpy()
    return table


def save_table(table, path=config.PROCESSED_PATH):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    table.to_parquet(path, index=False)
    return path
