# Three-minute demo script

1. Open **FG-28471 — Weather delay** and point out the isolated scenario queue and empty resolution timeline.
2. Start the dispatch call and answer as the Atlas Freight dispatcher.
3. Confirm that the truck is delayed by weather and offer a specific new arrival time later than the promised ETA.
4. Listen for Maya to read the time back. Confirm it.
5. Watch the live tool activity, then show the load change to **Rescheduled** and the new timeline event.
6. Reset the scenarios and open **FG-39204 — Damage risk**.
7. Tell Maya that several cartons may be water damaged. Maya should refuse to treat this as a routine reschedule and create an escalation.
8. Show the escalation ticket and post-call disposition in the operational record.

For the reliability path, use **FG-61033 — Load not located**. Its first write returns a temporary failure; Retell retries the same idempotency key and records only one action.

Useful questions for a technical review:

- Why does the model not receive permission to mutate arbitrary loads?
- What happens if Retell repeats a function request?
- How are two simultaneous demos kept separate?
- How would this move from synthetic data to a TMS integration?
