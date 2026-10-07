"""Features built from the step column."""

import pandas as pd

from .config import HOURS_PER_DAY


def add_time_features(df):
    out = pd.DataFrame(index=df.index)
    out['step'] = df['step'].astype('int16')
    out['hour_of_day'] = ((df['step'] - 1) % HOURS_PER_DAY).astype('int8')
    out['day_index'] = ((df['step'] - 1) // HOURS_PER_DAY).astype('int8')
    return out
