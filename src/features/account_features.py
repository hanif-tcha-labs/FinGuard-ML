"""History features for destination and origin accounts. Past steps only."""

import numpy as np
import pandas as pd

from .config import RECENT_WINDOW
from .velocity_features import prior_sums, prior_last_step


def add_destination_features(df, window=RECENT_WINDOW):
    dest_codes, _ = pd.factorize(df['nameDest'])
    orig_codes, _ = pd.factorize(df['nameOrig'])
    steps = df['step'].to_numpy()
    amount = df['amount'].to_numpy()
    ones = np.ones(len(df))

    out = pd.DataFrame(index=df.index)

    # Everything the destination received in earlier steps
    cnt_amt = prior_sums(dest_codes, steps, np.column_stack([ones, amount]),
                         dest_codes, steps)
    count_before, sum_before = cnt_amt[:, 0], cnt_amt[:, 1]
    out['dest_txn_count_before'] = count_before.astype('int32')
    out['dest_avg_amount_before'] = np.where(
        count_before > 0, sum_before / np.maximum(count_before, 1), -1.0).astype('float32')
    out['dest_is_new'] = (count_before == 0).astype('int8')

    # Distinct senders: count each (destination, sender) pair once, at its first step
    pair_code = dest_codes.astype(np.int64) * (orig_codes.max() + 1) + orig_codes
    pairs = pd.DataFrame({'pair': pair_code, 'dest': dest_codes, 'step': steps})
    first_seen = pairs.groupby('pair', sort=False).agg(dest=('dest', 'first'), step=('step', 'min'))
    new_pair = prior_sums(first_seen['dest'].to_numpy(), first_seen['step'].to_numpy(),
                          np.ones(len(first_seen)), dest_codes, steps)
    out['dest_unique_origins_before'] = new_pair[:, 0].astype('int32')

    # Recent activity: steps [step - window, step - 1]
    recent = prior_sums(dest_codes, steps, np.column_stack([ones, amount]),
                        dest_codes, steps, window=window)
    out['dest_txn_count_recent'] = recent[:, 0].astype('int32')
    out['dest_amount_sum_recent'] = recent[:, 1].astype('float32')

    last = prior_last_step(dest_codes, steps, dest_codes, steps)
    out['dest_steps_since_last'] = np.where(last >= 0, steps - last, -1).astype('int16')

    return out


def add_origin_features(df, window=RECENT_WINDOW):
    orig_codes, _ = pd.factorize(df['nameOrig'])
    steps = df['step'].to_numpy()
    amount = df['amount'].to_numpy()
    ones = np.ones(len(df))

    out = pd.DataFrame(index=df.index)

    cnt_amt = prior_sums(orig_codes, steps, np.column_stack([ones, amount]),
                         orig_codes, steps)
    count_before, sum_before = cnt_amt[:, 0], cnt_amt[:, 1]
    out['orig_txn_count_before'] = count_before.astype('int32')
    out['orig_is_repeat'] = (count_before > 0).astype('int8')
    out['orig_avg_amount_before'] = np.where(
        count_before > 0, sum_before / np.maximum(count_before, 1), -1.0).astype('float32')

    recent = prior_sums(orig_codes, steps, np.column_stack([ones, amount]),
                        orig_codes, steps, window=window)
    out['orig_txn_count_recent'] = recent[:, 0].astype('int32')
    out['orig_amount_sum_recent'] = recent[:, 1].astype('float32')

    return out
