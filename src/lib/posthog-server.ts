import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

function getPostHogClient() {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!projectToken || !host) {
    if (process.env.NODE_ENV === "development") {
      const variable = !projectToken
        ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
        : "NEXT_PUBLIC_POSTHOG_HOST";

      throw new Error(
        `${variable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`,
      );
    }

    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(projectToken, {
      host,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    });
  }

  return posthogClient;
}

type ServerEvent = {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
};

export async function captureServerEvent(event: ServerEvent) {
  const posthog = getPostHogClient();

  if (!posthog) {
    return;
  }

  try {
    posthog.capture(event);
    await posthog.flush();
  } catch (error) {
    console.error("PostHog event delivery failed", error);
  }
}

export async function captureServerException(error: unknown, distinctId: string) {
  const posthog = getPostHogClient();

  if (!posthog) {
    return;
  }

  try {
    posthog.captureException(error, distinctId);
    await posthog.flush();
  } catch (captureError) {
    console.error("PostHog exception delivery failed", captureError);
  }
}

export async function identifyServerUser(
  distinctId: string,
  properties: Record<string, unknown>,
) {
  const posthog = getPostHogClient();

  if (!posthog) {
    return;
  }

  try {
    posthog.identify({ distinctId, properties });
    await posthog.flush();
  } catch (error) {
    console.error("PostHog identity delivery failed", error);
  }
}
