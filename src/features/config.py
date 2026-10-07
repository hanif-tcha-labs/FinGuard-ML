"""Settings and feature registry for the feature engineering step."""

import os

RANDOM_SEED = 42

# Paths (relative to the notebooks/ folder)
RAW_PATH = os.path.join('..', 'data', 'raw', 'PS_20174392719_1491204439457_log.csv')
PROCESSED_PATH = os.path.join('..', 'data', 'processed', 'features_v1.parquet')

# 1 step = 1 hour in PaySim (checked in the notebook)
HOURS_PER_DAY = 24

# Window for the "recent activity" features, in steps (hours)
RECENT_WINDOW = 24

# The transaction types where fraud happens
FRAUD_TYPES = ['CASH_OUT', 'TRANSFER']

TRANSACTION_TYPES = ['CASH_IN', 'CASH_OUT', 'DEBIT', 'PAYMENT', 'TRANSFER']

# Columns we never use as model inputs
LEAKY_COLUMNS = ['newbalanceOrig', 'newbalanceDest', 'isFlaggedFraud']

# Feature registry: name -> (group, decision, short description)
# decision: keep / review / drop
FEATURES = {
    # transaction
    'amount_log': ('transaction', 'keep', 'log1p(amount)'),
    'oldbalanceOrg_log': ('transaction', 'keep', 'log1p(oldbalanceOrg)'),
    'oldbalanceDest_log': ('transaction', 'keep', 'log1p(oldbalanceDest)'),
    'amount_to_balance_ratio': ('transaction', 'keep', 'amount / oldbalanceOrg, -1 if the balance is 0'),
    'zero_old_balance_orig': ('transaction', 'keep', 'origin balance is 0 before the transaction'),
    'empties_balance_flag': ('transaction', 'review', 'amount >= 99% of origin balance'),
    # time
    'hour_of_day': ('time', 'keep', '(step - 1) % 24'),
    'day_index': ('time', 'review', '(step - 1) // 24'),
    # destination history (strictly earlier steps)
    'dest_txn_count_before': ('destination', 'keep', 'transactions received by the destination in earlier steps'),
    'dest_avg_amount_before': ('destination', 'keep', 'average amount received in earlier steps (-1 if none)'),
    'dest_unique_origins_before': ('destination', 'keep', 'distinct senders seen in earlier steps'),
    'dest_is_new': ('destination', 'keep', 'destination has no earlier transaction'),
    'dest_txn_count_recent': ('destination', 'keep', 'transactions received in the last 24 steps'),
    'dest_amount_sum_recent': ('destination', 'keep', 'amount received in the last 24 steps'),
    'dest_steps_since_last': ('destination', 'review', 'steps since the last earlier transaction (-1 if none)'),
    # origin history (strictly earlier steps)
    'orig_txn_count_before': ('origin', 'review', 'earlier transactions of the sender'),
    'orig_is_repeat': ('origin', 'review', 'sender has an earlier transaction'),
    'orig_avg_amount_before': ('origin', 'review', 'sender average amount in earlier steps (-1 if none)'),
    'orig_txn_count_recent': ('origin', 'review', 'sender transactions in the last 24 steps'),
    'orig_amount_sum_recent': ('origin', 'review', 'sender amount in the last 24 steps'),
}

# type one-hot columns are added by the pipeline
TYPE_COLUMNS = ['type_' + t for t in TRANSACTION_TYPES]
for _c in TYPE_COLUMNS:
    FEATURES[_c] = ('transaction', 'keep', 'one-hot of the transaction type')

# step itself is kept as a raw feature
FEATURES['step'] = ('time', 'keep', 'raw simulation hour')

# Considered but not built
DROPPED = {
    'newbalanceOrig / newbalanceDest and anything built from them': 'confirmed leakage (notebook 04)',
    'isFlaggedFraud': 'catches 0.19% of fraud',
    'dest_type (merchant / customer)': 'same information as type == PAYMENT',
    'period_early_late': 'mostly a volume artifact, risky for a temporal split',
    'nameOrig / nameDest as categories': 'too many unique values, used only as group keys',
}


def names_by_decision(decision):
    return [n for n, (_, d, _) in FEATURES.items() if d == decision]


def names_by_group(group):
    return [n for n, (g, _, _) in FEATURES.items() if g == group]
