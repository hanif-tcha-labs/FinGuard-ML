"""Helper for history features that never look at the current step or the future.

For every transaction we want sums over earlier transactions of the same account.
"Earlier" means a strictly smaller step. We do not use rows of the same step,
because PaySim has no order inside a step and we could not tell which came first.

"""

import numpy as np

# Larger than any step (max is 743), so account and step fit in one integer key.
STEP_BASE = 10_000


def _make_key(codes, steps):
    return codes.astype(np.int64) * STEP_BASE + steps.astype(np.int64)


def prior_sums(ev_codes, ev_steps, ev_values, q_codes, q_steps, window=None):
    """Sum event values of the same account over earlier steps.

    ev_*  : the events (one row per transaction, or per new pair)
    q_*   : the rows we want features for
    window: if given, only steps in [step - window, step - 1] are used

    Returns an array of shape (n_queries, n_value_columns).
    """
    ev_values = np.asarray(ev_values, dtype=np.float64)
    if ev_values.ndim == 1:
        ev_values = ev_values[:, None]

    # Group the events by (account, step)
    ev_key = _make_key(ev_codes, ev_steps)
    agg_key, inverse = np.unique(ev_key, return_inverse=True)
    agg = np.column_stack([
        np.bincount(inverse, weights=ev_values[:, j], minlength=len(agg_key))
        for j in range(ev_values.shape[1])
    ])

    # Prefix sums with a leading zero row, so cs[k] = sum of the first k groups
    cs = np.vstack([np.zeros((1, agg.shape[1])), np.cumsum(agg, axis=0)])

    q_codes = q_codes.astype(np.int64)
    q_steps = q_steps.astype(np.int64)

    # hi: groups strictly before (account, step)
    hi = np.searchsorted(agg_key, _make_key(q_codes, q_steps), side='left')
    if window is None:
        lo = np.searchsorted(agg_key, q_codes * STEP_BASE, side='left')
    else:
        low_step = np.maximum(q_steps - window, 0)
        lo = np.searchsorted(agg_key, q_codes * STEP_BASE + low_step, side='left')

    return cs[hi] - cs[lo]


def prior_last_step(ev_codes, ev_steps, q_codes, q_steps):
    """Step of the most recent earlier event of the same account, or -1 if none."""
    ev_key = _make_key(ev_codes, ev_steps)
    agg_key = np.unique(ev_key)

    q_codes = q_codes.astype(np.int64)
    hi = np.searchsorted(agg_key, _make_key(q_codes, q_steps), side='left')

    idx = hi - 1
    valid = idx >= 0
    prev_key = agg_key[np.where(valid, idx, 0)]
    same_account = valid & ((prev_key // STEP_BASE) == q_codes)
    return np.where(same_account, prev_key % STEP_BASE, -1)
