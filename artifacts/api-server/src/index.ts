import app from "./app";
import { logger } from "./lib/logger";
import { getIndex } from "./lib/retrieval";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Load the grounding corpus before accepting traffic. Parsing ~36 MB of JSON
// takes a moment; doing it lazily would stall whichever user happened to send
// the first message. A missing index is logged and tolerated, not fatal.
getIndex();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
