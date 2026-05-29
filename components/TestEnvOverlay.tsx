export function TestEnvOverlay() {
  const appEnv = process.env.APP_ENV;
  if (appEnv !== "test") return null;

  const repeatedText = Array.from({ length: 20 }, () => "TESTOVACÍ VERZE").join(" • ");

  return (
    <div
      aria-hidden="true"
      className="test-env-overlay"
      data-testid="test-env-overlay"
    >
      <div className="test-env-overlay__track">
        <span className="test-env-overlay__text">{repeatedText}</span>
        <span className="test-env-overlay__text">{repeatedText}</span>
      </div>
    </div>
  );
}
