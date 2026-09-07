import { Command, InvalidArgumentError } from "@commander-js/extra-typings";

export const number = (value: string) => {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0)
    throw new InvalidArgumentError("Expected a finite nonnegative number");
  return parsed;
};
export const positiveInteger = (value: string) => {
  const parsed = number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new InvalidArgumentError("Expected a positive integer");
  return parsed;
};
export const concurrencyValue = (value: string) => {
  const parsed = positiveInteger(value);
  if (parsed > 32) throw new InvalidArgumentError("Maximum concurrency is 32 per transport");
  return parsed;
};
export const attemptsValue = (value: string) => {
  const parsed = positiveInteger(value);
  if (parsed > 5) throw new InvalidArgumentError("Maximum attempts is 5");
  return parsed;
};
export const experimentOptions = () =>
  new Command()
    .argument("[experiment]", "Optional YAML configuration; explicit flags override it")
    .option("--id <id>", "Experiment label (default: cli)")
    .option("--dataset <id>", "Dataset manifest ID under datasets/<id>/manifest.json")
    .option("--language <tag>", "Select one benchmark language")
    .option("--languages <tags...>", "Benchmark languages, separated by commas or spaces")
    .option("--protocol <id>", "Versioned evaluation protocol")
    .option(
      "--compare <pairs...>",
      "Optional baseline:language pairs, separated by commas or spaces",
    )
    .option(
      "--transport <name>",
      "Transport for selected models: openai, anthropic, openrouter, fake",
    )
    .option("--models <ids...>", "Model IDs, separated by commas or spaces")
    .option("--efforts <levels...>", "low, medium, high, xhigh, max; default: medium")
    .option(
      "--max-output-tokens <count>",
      "Combined reasoning/output cap; protocol cap or 2048 by default",
      positiveInteger,
    )
    .option("--repeats <count>", "Repeats per question and condition (default: 1)", positiveInteger)
    .option(
      "--seed <number>",
      "Question selection and schedule seed (default: 42)",
      positiveInteger,
    )
    .option(
      "--question-limit <count>",
      "Unique test questions per language before expanding conditions",
      positiveInteger,
    )
    .option("--all-questions", "Clear a YAML question limit")
    .option(
      "--concurrency <count>",
      "Concurrent requests per transport (default: 1)",
      concurrencyValue,
    )
    .option("--max-attempts <count>", "Total attempts per job (default: 3)", attemptsValue)
    .option("--timeout-ms <milliseconds>", "Request timeout (default: 120000)", positiveInteger)
    .option("--budget-usd <amount>", "Optional total charged/reserved USD limit", number)
    .option("--no-budget", "Clear a YAML budget")
    .option("--no-pricing", "Clear YAML rates; preserve unknown costs")
    .option("--pricing-as-of <date>", "Date of the supplied rates (YYYY-MM-DD)")
    .option("--pricing-source <url>", "Source URL for the supplied rates")
    .option("--input-per-million <usd>", "USD per million uncached input tokens", number)
    .option("--cached-input-per-million <usd>", "USD per million cached input tokens", number)
    .option("--cache-write-per-million <usd>", "USD per million cache-write tokens", number)
    .option(
      "--cache-write1h-per-million <usd>",
      "USD per million one-hour cache-write tokens",
      number,
    )
    .option(
      "--output-per-million <usd>",
      "USD per million output tokens including reasoning",
      number,
    )
    .option("--offline", "Disallow dataset downloads (model APIs may still use the network)");
