# Luminara API server

Express + Drizzle backend for Luminara. Local-first friendly: it boots and
serves the PPD risk model and the chatbot even with no database — Postgres and
the local LLM light up more features when configured.

## Endpoints

| Method | Path                          | DB? | LLM? | Purpose |
| ------ | ----------------------------- | --- | ---- | ------- |
| GET    | `/api/healthz`                | –   | –    | Liveness check |
| POST   | `/api/ppd-risk`               | opt | –    | Score a de-identified PPD feature vector (see below) |
| POST   | `/api/chat`                   | opt | yes  | One companion-chatbot turn via local Ollama |
| POST   | `/api/research/submissions`   | yes | –    | Ingest an anonymized research bundle from the app |
| GET    | `/api/research/stats`         | opt | –    | Aggregate, non-identifying dataset stats |

`opt` = works without a DB but persists when one is present.

## PPD risk model

`src/lib/ppdModel.ts` is a transparent, literature-calibrated **logistic
regression** modelled on the framing of the [Mass General Brigham ML PPD
model](https://www.massgeneralbrigham.org/en/about/newsroom/press-releases/machine-learning-model-helps-identify-patients-at-risk-of-postpartum-depression):
it predicts postpartum-depression risk from information available around
delivery, with the **prenatal EPDS score** as the dominant term (as the paper
found). It is **not** the proprietary MGB model and **not** a diagnosis — every
score is explained by its per-feature contributions.

Example:

```bash
curl -sX POST localhost:4000/api/ppd-risk -H 'content-type: application/json' -d '{
  "features": {
    "epdsResponses": [1,1,2,1,2,1,1,2,1,0],
    "epdsIsPrenatal": true,
    "historyOfDepression": true,
    "lowSocialSupport": true
  }
}'
```

Returns `{ probability, riskScore, tier, relativeRisk, topContributors, interpretation, disclaimer, ... }`.

## Local setup

```bash
# 1. Local LLM
ollama pull llama3.1 && ollama serve

# 2. (optional) Postgres, then create tables
#    set DATABASE_URL, then:
pnpm --filter @workspace/db run push

# 3. Run the server
cp artifacts/api-server/.env.example artifacts/api-server/.env   # edit as needed
pnpm --filter @workspace/api-server run dev
```

## Deploying to a server

Set `OLLAMA_BASE_URL` to the Ollama instance running alongside the API (nothing
leaves your infrastructure — a deliberate privacy choice), set `DATABASE_URL`,
run `pnpm --filter @workspace/db run push`, then `pnpm --filter
@workspace/api-server run build && ... run start`.
