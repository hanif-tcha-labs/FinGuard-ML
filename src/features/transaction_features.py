"""Features built only from the current transaction."""

import numpy as np
import pandas as pd

from .config import TRANSACTION_TYPES


def add_transaction_features(df):
    """Return a new frame with the transaction-level features."""
    out = pd.DataFrame(index=df.index)

    out['amount_log'] = np.log1p(df['amount']).astype('float32')
    out['oldbalanceOrg_log'] = np.log1p(df['oldbalanceOrg']).astype('float32')
    out['oldbalanceDest_log'] = np.log1p(df['oldbalanceDest']).astype('float32')

    # Ratio is only defined when the sender has money. Same -1 rule as notebook 04.
    has_balance = df['oldbalanceOrg'] > 0
    ratio = np.where(has_balance, df['amount'] / df['oldbalanceOrg'].where(has_balance, 1.0), -1.0)
    out['amount_to_balance_ratio'] = ratio.astype('float32')

    out['zero_old_balance_orig'] = (~has_balance).astype('int8')
    out['empties_balance_flag'] = (has_balance & (out['amount_to_balance_ratio'] >= 0.99)).astype('int8')

    # One-hot with a fixed list of types, so train and API always get the same columns.
    for t in TRANSACTION_TYPES:
        out['type_' + t] = (df['type'] == t).astype('int8')

    return out
