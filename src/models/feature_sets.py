"""Feature sets used in the first experiments (decisions from notebook 05)."""

import numpy as np

CORE = [
    'amount_log', 'oldbalanceOrg_log', 'oldbalanceDest_log',
    'amount_to_balance_ratio', 'zero_old_balance_orig',
    'ratio_gap_to_one', 'ratio_is_one',
    'type_TRANSFER',
]

DEST_HISTORY = [
    'dest_txn_count_before', 'dest_avg_amount_before', 'dest_is_new',
    'dest_txn_count_recent', 'dest_amount_sum_recent', 'dest_steps_since_last',
]

TIME = ['hour_of_day']

FEATURE_SETS = {
    'S1_core': CORE,
    'S2_core_dest': CORE + DEST_HISTORY,
    'S3_core_dest_hour': CORE + DEST_HISTORY + TIME,
}

# Harder sets for notebook 07: the ratio features are removed, because the fraud
# rule "amount equals the balance" is probably a simulation effect.
NO_RATIO = [c for c in CORE
            if c not in ('amount_to_balance_ratio', 'ratio_gap_to_one', 'ratio_is_one')]

HARD_SETS = {
    'H1_no_ratio': NO_RATIO + DEST_HISTORY,
    'H1b_no_ratio_no_dest': NO_RATIO,
    'H2_no_origin_balance': ['amount_log', 'oldbalanceDest_log', 'type_TRANSFER'] + DEST_HISTORY,
}

NOT_USED = {
    'step, day_index': 'fraud median step is higher only because normal volume drops after step 400',
    'orig_* (5 features)': 'sender has no history in 99.85% of rows',
    'dest_unique_origins_before': 'same values as dest_txn_count_before',
    'empties_balance_flag': 'weak inside CASH_OUT / TRANSFER, replaced by ratio_is_one',
    'type_CASH_OUT, type_CASH_IN, type_DEBIT, type_PAYMENT': 'only CASH_OUT and TRANSFER are modelled, so type_TRANSFER is enough',
}


def add_ratio_features(table):
    """Add two features that say how close the amount is to the full balance.

    Built from amount_to_balance_ratio, which is already in the table.
    """
    ratio = table['amount_to_balance_ratio'].to_numpy(dtype='float64')
    has_balance = ratio >= 0
    gap = np.where(has_balance, np.abs(ratio - 1.0), 10.0)   # 10 = no balance
    table['ratio_gap_to_one'] = gap.astype('float32')
    table['ratio_is_one'] = (has_balance & (gap < 1e-6)).astype('int8')
    return table


def prepare_linear(X):
    """Tame the very skewed columns before scaling (for Logistic Regression only)."""
    X = X.copy()
    for col in ['amount_to_balance_ratio', 'ratio_gap_to_one']:
        if col in X:
            X[col] = X[col].clip(-1, 10)
    for col in ['dest_avg_amount_before', 'dest_amount_sum_recent']:
        if col in X:
            X[col] = np.log1p(X[col].clip(lower=0))
    for col in ['dest_txn_count_before', 'dest_txn_count_recent']:
        if col in X:
            X[col] = np.log1p(X[col])
    return X
