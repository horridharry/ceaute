import { ButtonLink } from "@/components/ui/button";
import {
  LetterPanel,
  LetterTemplate,
} from "@/components/templates/letter-template";

// T5 · Letter, the third and last one in the product. This is the provider's
// moment: the page is public and the link is the thing she needs in her hand.
export function PublishedLetter({ providerName, username, treatmentCount }) {
  const pageHref = `/@${username}`;

  return (
    <LetterTemplate
      eyebrow="Published"
      headline={`${providerName} is live.`}
      panel={
        <LetterPanel>
          <div className="flex flex-col gap-1">
            <span className="text-body-strong text-ink">
              ceaute.com/@{username}
            </span>
            <span className="text-[12.5px] text-black/60">
              Paste it where your Linktree was.
            </span>
          </div>
        </LetterPanel>
      }
      actions={
        <ButtonLink href={pageHref} variant="secondary">
          See it as a customer
        </ButtonLink>
      }
      exit={
        <ButtonLink href="/dashboard" variant="tertiary">
          Back to today
        </ButtonLink>
      }
    >
      Anyone with the link can book from your{" "}
      {treatmentCount === 1 ? "treatment" : `${treatmentCount} treatments`}, 24
      hours out and up to 60 days ahead. Deposits go to your Stripe. You can
      unpublish any time from Settings.
    </LetterTemplate>
  );
}
