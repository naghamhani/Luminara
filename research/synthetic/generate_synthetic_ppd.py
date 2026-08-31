"""
Luminara synthetic data generator
=================================

Produces two literature-calibrated synthetic tables that mirror exactly what the
Luminara app collects:

  1. participants.csv  — one row per participant. Mirrors `PpdFeatures`
     (artifacts/api-server/src/lib/ppdModel.ts) plus the outcome label used to
     train / benchmark the tabular predictive model.

  2. checkins.csv      — one row per participant-day. Mirrors the `checkIns`
     collection of `AnonymizedBundle` (artifacts/mobile/utils/anonymize.ts):
     offset-based (dayOffset, never an absolute date), 1-5 Likert ratings plus
     sleep hours and the app's own 0-100 riskScore.

  3. partner_observations.csv — one row per partner entry (1-5 ratings +
     counts), mirroring `partnerObservations` in the same bundle.

Design notes
------------
* Marginal prevalences and effect sizes are taken from the PPD risk-factor
  literature (see research/DATA_STRATEGY.md for citations). They are *plausible*,
  not fitted to any single cohort.
* The generative process is deliberately NOT the app's scoring function. The
  outcome is drawn from a latent-propensity model with interactions and noise,
  and EPDS is itself a noisy *measurement* of that latent propensity. This keeps
  the data honest: a model trained on it can be wrong, and EPDS dominates without
  being tautological.
* Missingness is injected (MAR) because real app users skip fields.

Usage
-----
    python generate_synthetic_ppd.py --n 5000 --seed 42 --out ./out
"""

from __future__ import annotations

import argparse
import os

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# 1. Marginal prevalences (probability a participant is positive)
# ---------------------------------------------------------------------------
PREVALENCE = {
    "historyOfDepression": 0.20,
    "historyOfAnxiety": 0.22,
    "priorPostpartumDepression": 0.07,   # conditioned on parity below
    "historyOfBipolar": 0.02,
    "currentlyOnPsychiatricMedication": 0.09,
    "firstPregnancy": 0.41,
    "unintendedPregnancy": 0.30,
    "lowSocialSupport": 0.18,
    "financialStrain": 0.25,
    "intimatePartnerViolence": 0.06,
    "recentStressfulLifeEvent": 0.28,
    "pregnancyComplications": 0.22,
    "cesareanDelivery": 0.32,
    "pretermBirth": 0.10,
    "multiplePregnancy": 0.03,
    "nicuAdmission": 0.09,
    "infantHealthProblems": 0.11,
    "breastfeedingDifficulty": 0.35,
    "severeSleepDeprivation": 0.30,
}

# Latent-propensity weights (log-odds). EPDS is intentionally absent here: it is
# generated downstream as a *measurement* of the same latent variable.
LATENT_BETA = {
    "priorPostpartumDepression": 1.20,
    "historyOfDepression": 1.00,
    "intimatePartnerViolence": 0.95,
    "lowSocialSupport": 0.80,
    "historyOfBipolar": 0.75,
    "historyOfAnxiety": 0.65,
    "financialStrain": 0.55,
    "recentStressfulLifeEvent": 0.50,
    "severeSleepDeprivation": 0.50,
    "unintendedPregnancy": 0.42,
    "nicuAdmission": 0.40,
    "currentlyOnPsychiatricMedication": 0.30,
    "pretermBirth": 0.35,
    "breastfeedingDifficulty": 0.32,
    "infantHealthProblems": 0.30,
    "pregnancyComplications": 0.28,
    "multiplePregnancy": 0.20,
    "cesareanDelivery": 0.15,
    "firstPregnancy": 0.18,
}
# Target population prevalence of PPD within ~6 months (CDC/WHO range is
# roughly 10-15%). The intercept is solved for numerically at generation time so
# that adding or reweighting risk factors never silently shifts the base rate.
TARGET_PREVALENCE = 0.13

# Fraction of each column left blank, mimicking real optional-field skip rates.
MISSING_RATE = {
    "epdsScore": 0.18,
    "ageYears": 0.05,
    "unintendedPregnancy": 0.15,
    "intimatePartnerViolence": 0.22,
    "financialStrain": 0.12,
    "lowSocialSupport": 0.10,
    "historyOfBipolar": 0.12,
    "currentlyOnPsychiatricMedication": 0.08,
}


def _solve_intercept(latent: np.ndarray, target: float) -> float:
    """Bisect for the intercept c such that mean(sigmoid(latent + c)) == target."""
    lo, hi = -20.0, 20.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if (1.0 / (1.0 + np.exp(-(latent + mid)))).mean() < target:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _bernoulli(rng: np.random.Generator, p: float, n: int) -> np.ndarray:
    return (rng.random(n) < p).astype(int)


def make_participants(n: int, rng: np.random.Generator) -> pd.DataFrame:
    df = pd.DataFrame(index=range(n))

    # --- demographics --------------------------------------------------------
    # Maternal age: right-skewed, centred ~29, clipped to a plausible range.
    age = rng.normal(29.5, 5.4, n)
    df["ageYears"] = np.clip(np.round(age), 15, 46).astype(int)

    df["firstPregnancy"] = _bernoulli(rng, PREVALENCE["firstPregnancy"], n)
    # Younger mothers are likelier to be primiparous.
    young = df["ageYears"] < 24
    df.loc[young, "firstPregnancy"] = _bernoulli(rng, 0.68, int(young.sum()))

    # --- history -------------------------------------------------------------
    for key in [
        "historyOfDepression",
        "historyOfAnxiety",
        "historyOfBipolar",
        "unintendedPregnancy",
        "lowSocialSupport",
        "financialStrain",
        "intimatePartnerViolence",
        "recentStressfulLifeEvent",
        "pregnancyComplications",
        "cesareanDelivery",
        "pretermBirth",
        "multiplePregnancy",
        "breastfeedingDifficulty",
        "severeSleepDeprivation",
        "infantHealthProblems",
    ]:
        df[key] = _bernoulli(rng, PREVALENCE[key], n)

    # Anxiety and depression are strongly comorbid.
    dep = df["historyOfDepression"] == 1
    df.loc[dep, "historyOfAnxiety"] = _bernoulli(rng, 0.55, int(dep.sum()))

    # Prior PPD is only defined for multiparous women, and implies prior depression.
    multip = df["firstPregnancy"] == 0
    df["priorPostpartumDepression"] = 0
    df.loc[multip, "priorPostpartumDepression"] = _bernoulli(rng, 0.12, int(multip.sum()))
    prior = df["priorPostpartumDepression"] == 1
    df.loc[prior, "historyOfDepression"] = 1

    # Psychiatric medication is largely conditional on a psychiatric history.
    hx = (df["historyOfDepression"] | df["historyOfAnxiety"] | df["historyOfBipolar"]) == 1
    df["currentlyOnPsychiatricMedication"] = 0
    df.loc[hx, "currentlyOnPsychiatricMedication"] = _bernoulli(rng, 0.30, int(hx.sum()))
    df.loc[~hx, "currentlyOnPsychiatricMedication"] = _bernoulli(rng, 0.01, int((~hx).sum()))

    # Preterm birth and multiples drive NICU admission.
    p_nicu = 0.04 + 0.45 * df["pretermBirth"] + 0.25 * df["multiplePregnancy"]
    df["nicuAdmission"] = (rng.random(n) < np.clip(p_nicu, 0, 0.95)).astype(int)
    # NICU / preterm raise the chance of infant health problems.
    p_infant = 0.06 + 0.35 * df["nicuAdmission"] + 0.10 * df["pretermBirth"]
    df["infantHealthProblems"] = (rng.random(n) < np.clip(p_infant, 0, 0.9)).astype(int)
    # Preterm / NICU also make breastfeeding harder.
    p_bf = 0.28 + 0.25 * df["pretermBirth"] + 0.15 * df["cesareanDelivery"]
    df["breastfeedingDifficulty"] = (rng.random(n) < np.clip(p_bf, 0, 0.9)).astype(int)

    # --- latent depression propensity ---------------------------------------
    lin = np.zeros(n, dtype=float)
    for key, beta in LATENT_BETA.items():
        lin += beta * df[key].to_numpy()

    # Younger-age ramp (25 -> 18), matching the app model's encoding.
    age_ramp = np.clip((25 - df["ageYears"].to_numpy()) / 7.0, 0, 1)
    lin += 0.50 * age_ramp

    # Interactions the additive app model cannot see — this is what makes the
    # dataset a genuine test rather than a restatement of the scoring function.
    lin += 0.55 * (df["lowSocialSupport"] & df["financialStrain"]).to_numpy()
    lin += 0.45 * (df["historyOfDepression"] & df["severeSleepDeprivation"]).to_numpy()
    lin -= 0.35 * ((df["lowSocialSupport"] == 0) & (df["historyOfDepression"] == 0)).to_numpy()

    # Unobserved heterogeneity (genetics, culture, care quality, ...).
    latent = lin + rng.normal(0, 0.85, n)

    # Solve for the intercept that puts mean P(PPD) at TARGET_PREVALENCE.
    intercept = _solve_intercept(latent, TARGET_PREVALENCE)
    latent = latent + intercept

    # --- EPDS as a noisy measurement of the latent state ---------------------
    # Map the latent log-odds onto the 0-30 EPDS range through a logistic link,
    # which reproduces the scale's characteristic right skew and floor effect at
    # 0. The additive sigma reflects EPDS test-retest / measurement error, and is
    # what stops the score from being a deterministic restatement of the label.
    epds_mu = 30.0 / (1.0 + np.exp(-(0.60 * latent + 0.15)))
    epds = epds_mu + rng.normal(0, 3.4, n)
    df["epdsScore"] = np.clip(np.round(epds), 0, 30).astype(int)
    df["epdsIsPrenatal"] = _bernoulli(rng, 0.55, n)

    # --- outcome -------------------------------------------------------------
    p = 1.0 / (1.0 + np.exp(-latent))
    df["ppd_within_6mo"] = (rng.random(n) < p).astype(int)
    # Keep the true probability for calibration studies; drop before training.
    df["_true_probability"] = np.round(p, 4)

    # --- identifiers ---------------------------------------------------------
    df.insert(0, "participantPseudonym", [f"P{i:06d}" for i in range(n)])
    # Coarse postpartum week at day 0, matching AnonymizedBundle.
    df["postpartumWeeksAtDayZero"] = np.clip(
        np.round(rng.gamma(2.0, 7.0, n)), 0, 104
    ).astype(int)

    # --- missingness (MAR) ---------------------------------------------------
    for col, rate in MISSING_RATE.items():
        if col not in df.columns:
            continue
        # Participants deeper into postpartum fill out fewer optional fields.
        adj = np.clip(rate * (1 + 0.010 * df["postpartumWeeksAtDayZero"]), 0, 0.6)
        mask = rng.random(n) < adj
        df.loc[mask, col] = np.nan

    ordered = [
        "participantPseudonym",
        "postpartumWeeksAtDayZero",
        "ageYears",
        "epdsScore",
        "epdsIsPrenatal",
        "historyOfDepression",
        "historyOfAnxiety",
        "priorPostpartumDepression",
        "historyOfBipolar",
        "currentlyOnPsychiatricMedication",
        "firstPregnancy",
        "unintendedPregnancy",
        "lowSocialSupport",
        "financialStrain",
        "intimatePartnerViolence",
        "recentStressfulLifeEvent",
        "pregnancyComplications",
        "cesareanDelivery",
        "pretermBirth",
        "multiplePregnancy",
        "nicuAdmission",
        "infantHealthProblems",
        "breastfeedingDifficulty",
        "severeSleepDeprivation",
        "_true_probability",
        "ppd_within_6mo",
    ]
    return df[ordered]


def app_risk_score(mood, sleep, anxiety, appetite, bonding, support):
    """Mirror of computeRiskScore in artifacts/mobile/context/AppContext.tsx."""
    mood_f = (5 - mood) / 4
    anx_f = (anxiety - 1) / 4
    hours = np.clip(sleep, 0, 12)
    sleep_f = np.where(hours < 6, np.maximum(0, (6 - hours) / 6), 0)
    app_f = (5 - appetite) / 4
    bond_f = (5 - bonding) / 4
    sup_f = (5 - support) / 4
    raw = (
        mood_f * 0.27
        + anx_f * 0.25
        + sleep_f * 0.15
        + app_f * 0.10
        + bond_f * 0.13
        + sup_f * 0.10
    )
    return np.clip(np.round(raw * 100), 0, 100).astype(int)


def _likert(rng, centre, n, invert=False):
    """Draw a 1-5 Likert rating around `centre` (already on the 1-5 scale)."""
    v = np.round(centre + rng.normal(0, 0.75, n))
    v = np.clip(v, 1, 5)
    return (6 - v if invert else v).astype(int)


def make_checkins(participants: pd.DataFrame, rng: np.random.Generator,
                  max_days: int = 90) -> pd.DataFrame:
    """One row per participant-day, offset-based like AnonymizedBundle."""
    rows = []
    for _, p in participants.iterrows():
        # Engagement is itself heterogeneous: most users log sporadically.
        n_days = int(np.clip(rng.gamma(2.2, 9.0), 3, max_days))
        offsets = np.sort(rng.choice(np.arange(max_days), size=n_days, replace=False))

        sev = p["_true_probability"]          # 0-1 latent severity
        # Higher severity -> lower mood/bonding/support, higher anxiety, less sleep.
        mood_c = 4.2 - 2.2 * sev
        anx_c = 1.9 + 2.2 * sev
        appetite_c = 3.9 - 1.6 * sev
        bonding_c = 4.3 - 2.0 * sev
        support_c = 4.0 - 1.9 * sev
        sleep_mu = 7.0 - 2.3 * sev - 1.2 * float(p["severeSleepDeprivation"] or 0)

        # Slow recovery/worsening trend across the logging window.
        trend = rng.normal(0.0, 0.006, 1)[0]
        drift = trend * offsets

        mood = _likert(rng, mood_c + drift, n_days)
        anxiety = _likert(rng, anx_c - drift, n_days)
        appetite = _likert(rng, appetite_c + drift, n_days)
        bonding = _likert(rng, bonding_c + drift, n_days)
        support = _likert(rng, support_c, n_days)
        sleep = np.clip(np.round(rng.normal(sleep_mu, 1.3, n_days) * 2) / 2, 0, 12)

        rows.append(pd.DataFrame({
            "participantPseudonym": p["participantPseudonym"],
            "dayOffset": offsets,
            "mood": mood,
            "sleep": sleep,
            "anxiety": anxiety,
            "appetite": appetite,
            "bonding": bonding,
            "support": support,
            "riskScore": app_risk_score(mood, sleep, anxiety, appetite, bonding, support),
        }))
    return pd.concat(rows, ignore_index=True)


def make_partner_observations(participants: pd.DataFrame, rng: np.random.Generator,
                              max_days: int = 90, coverage: float = 0.35) -> pd.DataFrame:
    """Partner-portal entries: 1-5 ratings plus stress/support counts."""
    rows = []
    for _, p in participants.iterrows():
        if rng.random() > coverage:
            continue  # no partner enrolled
        n_obs = int(np.clip(rng.gamma(1.6, 5.0), 1, 40))
        offsets = np.sort(rng.choice(np.arange(max_days), size=n_obs, replace=False))
        sev = p["_true_probability"]
        # Partners systematically under-detect distress: attenuated + biased up.
        mood = _likert(rng, 4.3 - 1.7 * sev, n_obs)
        energy = _likert(rng, 4.0 - 1.8 * sev, n_obs)
        sleep_q = _likert(rng, 3.9 - 1.9 * sev, n_obs)
        wellbeing = _likert(rng, 4.2 - 1.8 * sev, n_obs)
        rows.append(pd.DataFrame({
            "participantPseudonym": p["participantPseudonym"],
            "dayOffset": offsets,
            "mood": mood,
            "energy": energy,
            "sleepQuality": sleep_q,
            "overallWellbeing": wellbeing,
            "stressFactorCount": rng.binomial(8, 0.12 + 0.35 * sev, n_obs),
            "supportActivityCount": rng.binomial(8, 0.45 - 0.15 * sev, n_obs),
        }))
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate Luminara synthetic research data.")
    ap.add_argument("--n", type=int, default=5000, help="number of participants")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="out", help="output directory")
    ap.add_argument("--max-days", type=int, default=90)
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    os.makedirs(args.out, exist_ok=True)

    participants = make_participants(args.n, rng)
    checkins = make_checkins(participants, rng, args.max_days)
    partner = make_partner_observations(participants, rng, args.max_days)

    participants.to_csv(os.path.join(args.out, "participants.csv"), index=False)
    checkins.to_csv(os.path.join(args.out, "checkins.csv"), index=False)
    if not partner.empty:
        partner.to_csv(os.path.join(args.out, "partner_observations.csv"), index=False)

    rate = participants["ppd_within_6mo"].mean()
    print(f"participants        : {len(participants):>7,}  PPD prevalence {rate:.1%}")
    print(f"check-ins           : {len(checkins):>7,}")
    print(f"partner observations: {len(partner):>7,}")
    print(f"median EPDS         : {participants['epdsScore'].median():.0f}"
          f"  (EPDS>=13: {(participants['epdsScore'] >= 13).mean():.1%})")
    print(f"written to {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()
