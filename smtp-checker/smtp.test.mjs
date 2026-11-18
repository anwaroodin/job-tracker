import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyReply, verdict } from "./smtp.mjs";

test("classifies RCPT replies", () => {
  assert.equal(classifyReply({ code: 250, text: "250 2.1.5 OK" }), "accepted");
  assert.equal(classifyReply({ code: 550, text: "550 5.1.1 The email account does not exist" }), "rejected");
  assert.equal(classifyReply({ code: 550, text: "550 Requested action not taken: mailbox unavailable" }), "rejected");
  assert.equal(classifyReply({ code: 550, text: "550 5.7.606 Access denied, banned sending IP" }), "blocked");
  assert.equal(classifyReply({ code: 554, text: "554 Service unavailable; listed by Spamhaus" }), "blocked");
  assert.equal(classifyReply({ code: 451, text: "451 4.7.1 Greylisted, try again later" }), "unknown");
});

test("turns the target and catch-all probe into a status", () => {
  assert.equal(verdict("accepted", "rejected"), "valid");
  assert.equal(verdict("accepted", "accepted"), "accept_all");
  assert.equal(verdict("accepted", "unknown"), "unknown");
  assert.equal(verdict("rejected"), "not_found");
  assert.equal(verdict("blocked"), "blocked");
  assert.equal(verdict("unknown"), "unknown");
});
