"use client";

import { useState } from "react";
import { ListGroup, ListTemplate } from "@/components/templates/list-template";
import {
  DetailBody,
  DetailSection,
  DetailTemplate,
} from "@/components/templates/detail-template";
import { FormTemplate } from "@/components/templates/form-template";
import { PickerTemplate } from "@/components/templates/picker-template";
import {
  LetterPanel,
  LetterTemplate,
} from "@/components/templates/letter-template";
import { Button, ButtonPair, TextButton } from "@/components/ui/button";
import { Chip, ChipRow } from "@/components/ui/chip";
import { SearchInput, TextInput } from "@/components/ui/field";
import { PriceInput } from "@/components/ui/price-input";
import { DurationSelect } from "@/components/ui/duration-select";
import { FieldPair } from "@/components/ui/field";
import { CommitBar } from "@/components/ui/commit-bar";
import { ModalTopBar, StackedTopBar } from "@/components/ui/top-bar";
import { ProviderCard } from "@/components/ui/provider-card";
import { BookingCard } from "@/components/ui/booking-card";
import { ReviewCard } from "@/components/ui/review-card";
import { TreatmentRow } from "@/components/ui/treatment-row";
import { SettingRow } from "@/components/ui/setting-row";
import { SummaryCard, SummaryLine } from "@/components/ui/summary-card";
import { InfoNotice } from "@/components/ui/notice";
import { HeldRow } from "@/components/ui/held-row";
import { DayStrip } from "@/components/ui/day-strip";
import { SlotGrid } from "@/components/ui/slot-grid";

// Each template is shown inside a 390px frame, the width the designs are drawn
// at, so the phone layout is what gets reviewed.
function Frame({ id, title, note, children }) {
  return (
    <section className="flex w-[390px] shrink-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-label uppercase text-black/45">{id}</h2>
        <p className="text-[13px] font-medium text-ink">{title}</p>
        <p className="text-[12px]/[1.6] text-black/55">{note}</p>
      </div>
      <div className="h-[760px] overflow-y-auto rounded-modal border border-black/12 bg-white">
        {children}
      </div>
    </section>
  );
}

export function TemplateGallery() {
  const [day, setDay] = useState("2026-09-23");
  const [slot, setSlot] = useState("11:45");
  const heldUntil = useState(() => Date.now() + 5 * 60 * 1000)[0];

  return (
    <main className="min-h-screen bg-[#f0eee9] px-6 py-10">
      <header className="mb-8">
        <h1 className="text-display text-pretty text-ink">Templates</h1>
        <p className="mt-2 max-w-[640px] text-body text-black/60">
          Phase 2 of the build order. The five layouts from 03-screens.md, each
          filled with approved components only. Every route maps to exactly one
          of these. This route is not reachable in production.
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-6">
        <Frame
          id="T1 · List"
          title="Discover"
          note="Title → search / tabs / chips → a stack of one card or row kind, 8px apart, group labels between. No commit bar: a list never commits anything."
        >
          <ListTemplate
            title="Lashes in Manchester"
            meta="3 providers"
            filters={
              <>
                <SearchInput defaultValue="lashes" aria-label="Search" />
                <ChipRow>
                  <Chip label="Manchester" count={3} selected />
                  <Chip label="Salford" count={1} />
                  <Chip label="Stockport" />
                </ChipRow>
              </>
            }
          >
            <ListGroup label="Newest page">
              <ProviderCard
                href="/design-system/templates"
                name="Byuwauk"
                rating="5.0"
                reviewCount={12}
                category="Lashes"
                area="Manchester"
                fromPriceLabel="£11"
              />
            </ListGroup>
            <ListGroup label="More in Manchester">
              <ProviderCard
                href="/design-system/templates"
                name="Lash by Ola"
                reviewCount={0}
                category="Lashes"
                area="Salford"
                fromPriceLabel="£35"
              />
              <BookingCard
                weekdayLabel="Fri"
                dayLabel="18"
                title="Volume full set"
                amountLabel="£40.00"
                meta="Byuwauk · 14:00 · Manchester"
                status="confirmed"
                statusLabel="Confirmed"
              />
            </ListGroup>
          </ListTemplate>
        </Frame>

        <Frame
          id="T2 · Detail"
          title="Provider page (with hero)"
          note="Stacked nav → hero → title + meta → body → sections separated by 24px and a hairline, each with a heading and an optional See all → commit bar."
        >
          <DetailTemplate
            nav={<StackedTopBar backHref="/design-system/templates" backLabel="Discover" />}
            hero={
              <div className="relative h-[216px] w-full bg-surface">
                <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-1 text-[11.5px] font-medium text-white">
                  1 / 9
                </span>
              </div>
            }
            title="Byuwauk"
            meta="@byuwauk · Lashes · Manchester · 5.0 (34)"
            commitBar={
              <CommitBar contextLabel="from £11" contextDetail="Next free: tomorrow 11:45">
                <Button block={false} className="px-6">
                  Book
                </Button>
              </CommitBar>
            }
          >
            <DetailBody>
              {"Lash artist in Fallowfield. Classic, hybrid and volume.\nInfills welcome two to three weeks after your set."}
            </DetailBody>

            <DetailSection heading="Portfolio" actionLabel="See all 9" actionHref="/design-system/templates">
              <p className="-mt-1 text-[12.5px] text-black/50">Recent sets by Byuwauk</p>
              <div className="flex gap-2 overflow-x-auto">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-[140px] w-[118px] shrink-0 rounded-row bg-surface" />
                ))}
              </div>
            </DetailSection>

            <DetailSection heading="Treatments" actionLabel="See all 21" actionHref="/design-system/templates">
              <TreatmentRow name="Classic full set" meta="2h 15m · £40.00" />
              <TreatmentRow name="Hybrid infill" meta="1h 30m · £28.00" />
            </DetailSection>

            <DetailSection heading="Reviews" actionLabel="All 34" actionHref="/design-system/templates">
              <p className="-mt-1 text-[12.5px] text-black/50">5.0 average · verified bookings only</p>
              <ReviewCard
                reviewerFirstName="Precious"
                rating={5}
                dateLabel="Aug"
                treatmentName="Sapphire set"
                comment="Lasted the full three weeks, barely any shedding. Very gentle."
              />
            </DetailSection>

            <DetailSection heading="Policies">
              <SettingRow title="Deposit" value="£10 to book, the rest on the day" />
              <SettingRow title="Cancellation" value="Free until 24 hours before" />
            </DetailSection>
          </DetailTemplate>
        </Frame>

        <Frame
          id="T3 · Form"
          title="Review & pay"
          note="Modal nav → fields in one column 13px apart → notice → commit bar with the single primary. The template is the form, so nav Save and the bar's primary are one submission."
        >
          <FormTemplate
            nav={
              <ModalTopBar title="Review & pay">
                <button type="submit" className="text-[14px] font-semibold text-plum">
                  Save
                </button>
              </ModalTopBar>
            }
            notice={
              <InfoNotice>
                Cancel more than 24 hours before and you get £30 back. Inside 24
                hours, the £10 commitment stays with me.
              </InfoNotice>
            }
            commitBar={
              <CommitBar contextLabel="£10.00 now" contextDetail="£36.00 due on the day">
                <Button block={false} className="px-6">
                  Pay and book
                </Button>
              </CommitBar>
            }
            onSubmit={(event) => event.preventDefault()}
          >
            <TextInput name="demo-name" label="Full name" placeholder="Shanice Adeyemi" />
            <TextInput name="demo-phone" label="Phone" type="tel" placeholder="07700 900123" />
            <FieldPair>
              <PriceInput name="demo-price" defaultValue="40" />
              <DurationSelect name="demo-duration" defaultValue={135} />
            </FieldPair>
            <SummaryCard className="mt-2">
              <SummaryLine label="Classic full set" value="£40.00" />
              <SummaryLine label="Bottom lashes" value="£6.00" />
              <SummaryLine label="Pay today" value="£10.00" total />
            </SummaryCard>
          </FormTemplate>
        </Frame>

        <Frame
          id="T4 · Picker"
          title="Pick a time"
          note="Stacked nav → held row → title → month header and five-day strip → day name → slot grid → commit bar showing the chosen time. The CTA is a plain Continue."
        >
          <PickerTemplate
            nav={<StackedTopBar backHref="/design-system/templates" backLabel="Byuwauk" stepLabel="2 / 3" />}
            heldRow={<HeldRow appointmentLabel="Wed 23 Sep, 11:45" expiresAt={heldUntil} />}
            title="Pick a time"
            subtitle="2h 30m in total"
            dayStrip={
              <DayStrip
                monthLabel="September 2026"
                value={day}
                onSelect={setDay}
                onPrevious={() => {}}
                onNext={() => {}}
                days={[
                  { value: "2026-09-21", weekdayLabel: "Mon", dayLabel: "21" },
                  { value: "2026-09-22", weekdayLabel: "Tue", dayLabel: "22", closed: true },
                  { value: "2026-09-23", weekdayLabel: "Wed", dayLabel: "23" },
                  { value: "2026-09-24", weekdayLabel: "Thu", dayLabel: "24" },
                  { value: "2026-09-25", weekdayLabel: "Fri", dayLabel: "25" },
                ]}
              />
            }
            dayLabel="Wednesday"
            commitBar={
              <CommitBar contextLabel="11:45" contextDetail="until 13:20">
                <Button block={false} className="px-6">
                  Continue
                </Button>
              </CommitBar>
            }
          >
            <SlotGrid
              value={slot}
              onSelect={setSlot}
              slots={["09:00", "09:45", "11:45", "13:15", "14:00", "16:30"].map((time) => ({
                value: time,
                label: time,
              }))}
            />
          </PickerTemplate>
        </Frame>

        <Frame
          id="T5 · Letter"
          title="Confirmed"
          note="Wordmark-only nav with nothing in the top right → eyebrow → 30px headline → one paragraph → one framed panel → button pair → a quiet text button. Every exit sits in the bottom third."
        >
          <LetterTemplate
            eyebrow="Confirmed"
            headline="You're booked in with Byuwauk."
            panel={
              <LetterPanel>
                <div className="flex gap-3">
                  <div className="size-16 shrink-0 rounded-row bg-white" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-body-strong text-ink">Classic full set</span>
                    <span className="text-[12.5px] text-black/60">Wed 23 Sep · 11:45 – 13:20</span>
                    <span className="text-[12.5px] text-black/60">14 Wilmslow Road, Manchester</span>
                  </div>
                </div>
              </LetterPanel>
            }
            actions={
              <ButtonPair>
                <Button variant="secondary">Directions</Button>
                <Button variant="tertiary">Add to calendar</Button>
              </ButtonPair>
            }
            exit={<TextButton>Back to my bookings</TextButton>}
          >
            She has your £10 and the rest is due on the day. We&apos;ve emailed
            you the address and what to expect.
          </LetterTemplate>
        </Frame>
      </div>
    </main>
  );
}
