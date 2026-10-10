"""Time-based split. Train on the past, validate and test on the future."""

TRAIN_END_STEP = 500   # train: step <= 500
VAL_END_STEP = 620     # validation: 501..620, test: 621..743 (kept untouched for now)


def temporal_masks(table, train_end=TRAIN_END_STEP, val_end=VAL_END_STEP):
    step = table['step']
    train = step <= train_end
    val = (step > train_end) & (step <= val_end)
    test = step > val_end
    return train, val, test
