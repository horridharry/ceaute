"use client";

import { useState } from "react";
import { Button, ButtonLink, ButtonPair, InlineLink, TextButton } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, FieldPair, FieldStack, SearchInput, Select, TextArea, TextInput } from "@/components/ui/field";
import { AddOnDurationSelect, DurationSelect } from "@/components/ui/duration-select";
import { PriceInput } from "@/components/ui/price-input";
import { CodeInput } from "@/components/ui/code-input";
import { Chip, ChipRow } from "@/components/ui/chip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import { OptionCard, OptionCardPair } from "@/components/ui/option-card";
import { Toggle } from "@/components/ui/toggle";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusDot } from "@/components/ui/status";
import { InfoNotice, ProblemNotice } from "@/components/ui/notice";
import { EmptyState } from "@/components/ui/empty-state";
import { HeldRow } from "@/components/ui/held-row";
import { TreatmentRow } from "@/components/ui/treatment-row";
import { AddOnList, AddOnRow } from "@/components/ui/add-on-row";
import { SettingRow } from "@/components/ui/setting-row";
import { ProviderCard } from "@/components/ui/provider-card";
import { BookingCard } from "@/components/ui/booking-card";
import { ReviewCard } from "@/components/ui/review-card";
import { SummaryCard, SummaryLine } from "@/components/ui/summary-card";
import { ModalTopBar, RootTopBar, StackedTopBar } from "@/components/ui/top-bar";
import { AvatarMenu } from "@/components/ui/avatar-menu";
import { ProviderNav } from "@/components/ui/provider-nav";
import { CommitBar } from "@/components/ui/commit-bar";
import { DayStrip } from "@/components/ui/day-strip";
import { SlotGrid } from "@/components/ui/slot-grid";
import { Modal } from "@/components/ui/modal";

function Frame({ title, note, children, wide = false }) {
  return (
    <section
      className={`flex flex-col gap-3 rounded-modal border border-black/12 bg-white p-[22px] ${
        wide ? "lg:col-span-2" : ""
      }`}
    >
      <h2 className="text-label uppercase text-black/45">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
      {note ? <p className="text-[12px]/[1.6] text-black/55">{note}</p> : null}
    </section>
  );
}

async function pretendToCommit() {
  await new Promise((resolve) => setTimeout(resolve, 1400));
}

export function ComponentGallery() {
  const [chip, setChip] = useState("toes");
  const [segment, setSegment] = useState("upcoming");
  const [tab, setTab] = useState("treatments");
  const [day, setDay] = useState("2026-09-23");
  const [slot, setSlot] = useState("11:45");
  const [modalOpen, setModalOpen] = useState(false);
  const heldUntil = useState(() => Date.now() + 5 * 60 * 1000)[0];

  return (
    <main className="min-h-screen bg-[#f0eee9] px-6 py-10">
      <header className="mx-auto mb-8 max-w-[1240px]">
        <h1 className="text-display text-pretty text-ink">Components</h1>
        <p className="mt-2 max-w-[640px] text-body text-black/60">
          Phase 1 of the build order. Each component appears once with its
          states, in the order it is listed in 02-components.md, to be checked
          against §2 of the MVP spec. This route is not reachable in production.
        </p>
      </header>

      <div className="mx-auto grid max-w-[1240px] grid-cols-1 items-start gap-[18px] md:grid-cols-2 lg:grid-cols-3">
        <Frame
          title="Buttons"
          note="Height 48, radius 11, label 500/14.5. One primary per screen. Loading swaps the label for a 16px spinner and holds the width."
        >
          <Button variant="primary">Primary · one per screen</Button>
          <Button variant="secondary">Secondary · ink</Button>
          <Button variant="tertiary">Tertiary · outline</Button>
          <Button variant="destructive">Destructive · outline only</Button>
          <Button variant="primary" disabled>
            Disabled · 40%
          </Button>
          <ButtonPair>
            <Button variant="tertiary">Split</Button>
            <Button variant="tertiary">Pair</Button>
          </ButtonPair>
          <form action={pretendToCommit}>
            <SubmitButton pendingLabel="Saving">Loading · press me</SubmitButton>
          </form>
          <div className="text-center">
            <TextButton>Text button · quiet</TextButton>
          </div>
          <InlineLink href="/design-system">Inline link · plum, no underline</InlineLink>
          <ButtonLink href="/design-system" variant="tertiary">
            Link styled as a button
          </ButtonLink>
        </Frame>

        <Frame
          title="Inputs"
          note="White fill, 1px border-strong, radius 10. Focus thickens the border to 1.5px plum without changing the box size. At most one helper line per screen."
        >
          <FieldStack>
            <TextInput name="full-name" label="Full name" placeholder="Shanice Adeyemi" />
            <TextInput
              name="email"
              label="Email"
              type="email"
              defaultValue="not-an-email"
              error="Enter an email address we can reach you on."
            />
            <TextInput
              name="handle"
              label="Handle"
              defaultValue="byuwauk"
              helper="This is the last part of your page address."
            />
            <TextInput name="locked" label="Disabled" defaultValue="Locked" disabled />
            <TextArea
              name="description"
              label="Description"
              optional
              placeholder="What the treatment involves."
            />
            <Select name="window" label="Cancellation window" defaultValue="24">
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
            </Select>
            <FieldPair>
              <PriceInput name="price" defaultValue="40" />
              <DurationSelect name="duration" defaultValue={135} />
            </FieldPair>
            <AddOnDurationSelect name="add-on-duration" defaultValue={15} />
            <SearchInput placeholder="Search treatments or places" aria-label="Search" />
            <Field id="code" label="Verification code">
              <CodeInput id="code" />
            </Field>
          </FieldStack>
        </Frame>

        <Frame
          title="Selection"
          note="Chips wrap and carry their count in the label. The active segment is the one small shadow the system allows."
        >
          <ChipRow>
            {[
              { value: "toes", label: "Toes", count: 4 },
              { value: "lashes", label: "Lashes", count: 12 },
              { value: "brows", label: "Brows" },
            ].map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                count={item.count}
                selected={chip === item.value}
                onClick={() => setChip(item.value)}
              />
            ))}
            <Chip label="+ New group" action />
          </ChipRow>

          <SegmentedControl
            name="Bookings"
            value={segment}
            onSelect={setSegment}
            items={[
              { value: "upcoming", label: "Upcoming" },
              { value: "past", label: "Past" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />

          <Tabs
            label="Treatments"
            value={tab}
            onSelect={setTab}
            items={[
              { value: "treatments", label: "Treatments" },
              { value: "groups", label: "Groups" },
              { value: "add-ons", label: "Add-ons" },
            ]}
          />

          <OptionCardPair>
            <OptionCard
              name="payment-mode"
              value="full"
              title="Full payment"
              explanation="She pays everything up front."
              defaultChecked
            />
            <OptionCard
              name="payment-mode"
              value="deposit"
              title="Deposit"
              explanation="A fixed amount now, the rest on the day."
            />
          </OptionCardPair>

          <Toggle
            name="show-on-page"
            label="Show on my page"
            description="Visible to anyone with your link."
            defaultChecked
          />
          <Checkbox name="terms" label="Checkbox, 20px, plum when on" defaultChecked />
        </Frame>

        <Frame
          title="Day strip and slots"
          note="Five days, never seven. A closed day sits at 35% opacity rather than disappearing. Only bookable starts appear, with no caption explaining the gaps."
        >
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
          <SlotGrid
            value={slot}
            onSelect={setSlot}
            slots={["09:00", "09:45", "11:45", "13:15", "14:00", "16:30"].map((time) => ({
              value: time,
              label: time,
            }))}
          />
        </Frame>

        <Frame
          title="Status, notices, empty"
          note="Status is a dot plus a word — no pills and no tinted backgrounds. A problem is a hairline row with a coloured dot, never a filled red box."
        >
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <StatusDot status="confirmed" label="Confirmed" />
            <StatusDot status="completed" label="Completed" />
            <StatusDot status="awaiting_payment" label="Awaiting payment" />
            <StatusDot status="refund_required" label="Refund processing" />
            <StatusDot status="refund_failed" label="Refund failed" />
          </div>
          <HeldRow appointmentLabel="Wed 23 Sep, 11:45" expiresAt={heldUntil} />
          <InfoNotice>
            Cancel more than 24 hours before and you get £30 back. Inside 24
            hours, the £10 commitment stays with me.
          </InfoNotice>
          <ProblemNotice title="That time has just gone">
            Someone else paid for 11:45 while you were checking out. Nothing has
            been charged.
          </ProblemNotice>
          <ProblemNotice tone="pending" title="Refund processing">
            Your bank usually shows it within five working days.
          </ProblemNotice>
          <EmptyState
            title="No bookings yet"
            actionHref="/discover"
            actionLabel="Find someone"
          >
            When you book someone, it shows here with the address and what&apos;s due.
          </EmptyState>
        </Frame>

        <Frame
          title="Rows"
          note="Treatment rows are filled so they read as tappable products; everything else is outlined. The treatment description lives in the modal, never on the row."
        >
          <TreatmentRow name="Classic full set" meta="2h 15m · £40.00" onOpenDetails={() => setModalOpen(true)} />
          <TreatmentRow name="Hybrid infill" meta="1h 30m · £28.00" onOpenDetails={() => setModalOpen(true)} />
          <AddOnList>
            <AddOnRow name="Coloured lashes" delta="+ £3 · + 5 min" value="1" />
            <AddOnRow name="Bottom lashes" delta="+ £6 · + 15 min" value="2" defaultChecked />
            <AddOnRow name="Removal" delta="+ £5" value="3" />
            <AddOnRow name="Aftercare kit" delta="+ £4" value="4" />
            <AddOnRow name="Lash tint" delta="+ £3" value="5" />
            <AddOnRow name="Brow tidy" delta="+ £8 · + 15 min" value="6" />
            <AddOnRow name="Patch test" delta="+ £0" value="7" />
          </AddOnList>
          <SettingRow title="Booking terms" value="Deposit £10 · cancel free until 24h" href="/design-system" />
          <SettingRow title="Payments" value="Ready" action="edit" />
        </Frame>

        <Frame
          title="Cards"
          note="The provider card is the only card with a photograph, and the rating leads its meta line because trust is the whole problem on a marketplace of strangers."
        >
          <ProviderCard
            href="/design-system"
            name="Byuwauk"
            rating="5.0"
            reviewCount={12}
            category="Lashes"
            area="Manchester"
            fromPriceLabel="£28"
          />
          <ProviderCard
            href="/design-system"
            name="Eluxe UK"
            reviewCount={0}
            category="Nails"
            area="Salford"
            fromPriceLabel="£22"
          />
          <BookingCard
            href="/design-system"
            weekdayLabel="Wed"
            dayLabel="23"
            title="Classic full set"
            amountLabel="£40.00"
            meta="Byuwauk · Manchester · 11:45"
            status="confirmed"
            statusLabel="Confirmed"
          />
          <ReviewCard
            reviewerFirstName="Shanice"
            rating={5}
            dateLabel="12 Aug"
            treatmentName="Classic full set"
            comment="Lovely set, lasted four weeks and she talked me through the aftercare properly."
          />
          <SummaryCard>
            <SummaryLine label="Classic full set" value="£40.00" />
            <SummaryLine label="Bottom lashes" value="£6.00" />
            <SummaryLine label="Paid now" value="£10.00" />
            <SummaryLine label="Due on the day" value="£36.00" total />
          </SummaryCard>
        </Frame>

        <Frame
          title="Navigation"
          note="The avatar is the only top-right control a customer sees, and it is never the way out of a task. The provider nav is a visible strip, not a drawer, and becomes a left column on desktop."
        >
          <RootTopBar>
            <AvatarMenu initial="S" providerHref="/dashboard" hasProviderPage />
          </RootTopBar>
          <StackedTopBar backHref="/design-system" backLabel="Byuwauk" stepLabel="Step 2 of 4" />
          <ModalTopBar title="Edit treatment" onCancel={() => {}}>
            <button type="button" className="text-[14px] font-semibold text-plum">
              Save
            </button>
          </ModalTopBar>
          <ProviderNav value="today" orientation="horizontal" />
          <CommitBar contextLabel="£10.00 now" contextDetail="£36.00 due on the day" className="static px-0 pb-0">
            <Button block={false} className="px-6">
              Pay and book
            </Button>
          </CommitBar>
        </Frame>

        <Frame
          title="Modal"
          note="One modal pattern, not two. Centred, radius 18, with the only large shadow in the system. Bottom sheets were removed deliberately."
        >
          <Button variant="tertiary" onClick={() => setModalOpen(true)}>
            Open the treatment detail
          </Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Classic full set"
            footer={<Button>Choose a time</Button>}
          >
            <p className="text-body text-black/80">
              A full set of individual lashes applied one at a time. Lasts three
              to four weeks with an infill.
            </p>
            <p className="mt-3 text-[12.5px] text-black/50">2h 15m · £40.00</p>
          </Modal>
        </Frame>
      </div>
    </main>
  );
}
