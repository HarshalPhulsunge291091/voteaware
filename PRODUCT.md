# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript, Tailwind CSS v4. Frontend-only for now (no backend wired yet; data is local/mock).

## Users

Young Indian voters (roughly first-time to under-35 voters) who want to understand how their own local Member of Parliament is actually performing, rather than following national political narratives. Not policy wonks — casual, civically curious users checking their own constituency.

## Product Purpose

VoteAware is a civic-accountability app that grades individual Lok Sabha MPs on concrete, checkable performance: MPLADS fund utilization (money allotted vs. spent vs. left unspent) and works promised vs. works actually completed in their constituency. Success = a young voter can look up their MP and understand, in under a minute, whether their money and promises turned into results.

## Positioning

Existing civic-accountability tools (e.g. the andhbhakt/GovLens project this app is modeled after) operate at the national level — cabinet ministers, central schemes, CAG-vs-PIB narrative gaps. VoteAware is deliberately local: it grades the individual MP a given user actually voted for, using MPLADS fund-utilization data that national platforms don't surface. "Is my MP doing their job" is a question no existing tool answers directly.

## Operating Context

- Primary flow: search/browse for an MP (by name, constituency, or state) → view their scorecard (grade, funds allotted/spent/unspent, works completed vs. promised) → optionally compare or explore other MPs.
- A landing/home page introduces the product and gets a first-time visitor into that search flow.
- No login/account system planned for the MVP.

## Capabilities and Constraints

- Confirmed: MP grading system (letter grade or numeric score), MPLADS fund tracking (allotted vs. spent vs. unspent balance), works completed vs. promised tracking, MP search/list, MP detail/scorecard page, home/landing page.
- Data source: undecided/future work — MVP uses mock/placeholder data for a handful of sample MPs (real MPLADS data acquisition via mplads.gov.in or similar is a later phase, not part of this design pass).
- No backend/API yet — data will initially live as local static data in the frontend.
- Bilingual (Hindi) support: not yet decided: value of design is undetermined — is this expected for launch,left open for now.

## Brand Commitments

Name: "VoteAware". No logo, palette, or typography commitments yet — visual identity is open for this design pass.

## Evidence on Hand

No real MPLADS data, MP records, or constituency data on hand yet. All MP names, grades, and fund figures used in this design pass are illustrative placeholders and must be clearly treated as such (not presented as real claims about real people).

## Product Principles

1. Local over national — every screen roots back to "your MP, your constituency," not abstract national politics.
2. Numbers over narrative — grades must be traceable to the underlying allotted/spent/works data, never an opaque score.
3. Trustworthy but not bureaucratic — feels credible and data-driven without looking like a dull government portal.
4. Fast comprehension — a first-time visitor should grasp their MP's standing in well under a minute.
5. Non-partisan framing — the product grades performance/spending facts, not party affiliation or ideology.
