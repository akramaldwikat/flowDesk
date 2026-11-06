# License decision — MIT approved

**Selected and applied in Phase 4 Part B: MIT License.** Akram explicitly approved the standard license with copyright holder Akram Aldwikat and year 2026. [Authoritative project LICENSE](../LICENSE). The comparison below records the earlier Part A recommendation; it introduces no additional terms.

[TEXT] FlowDesk is independent portfolio software; the request is to compare options, not apply one. [ASSUMPTION] Akram controls the original project contributions; dependencies/fonts/icons retain their own licenses. This compares license texts for a global GitHub repository. Jordanian enforcement, employment/IP ownership and patent ownership are not determined here; those need separate verification if disputed. No statutory or case-law conclusion is needed for this narrow selection.

| Choice                                  | Reuse and conditions                                                                                                                                           | Portfolio tradeoff                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| MIT                                     | Broad use, modification and commercial distribution; retain copyright/license notices. No express patent grant in its text.                                    | Short and familiar. Others may make proprietary derivatives.                             |
| Apache-2.0                              | Broad reuse, express contributor patent grant with termination provisions; notice preservation, changed-file identification and applicable NOTICE obligations. | Clearer patent framework, more detailed administration.                                  |
| No license / rights retained by default | No general open-source reuse grant; platform terms and legal exceptions can still permit actions.                                                              | Inspection-focused, less inviting for experimentation. Public visibility is not secrecy. |

[TEXT] Sources, checked 7 November 2026: [MIT text](https://choosealicense.com/licenses/mit/), [Apache-2.0 sections 3–4](https://www.apache.org/licenses/LICENSE-2.0), [GitHub's no-license explanation](https://choosealicense.com/no-permission/). These summarize terms, not outcomes in every jurisdiction's courts. GitHub viewing/forking rights do not equal unrestricted reuse permission.

[INFERENCE, confidence: likely] **Recommend MIT** for this freelance portfolio. It makes review/reuse terms brief and understandable. Apache-2.0 is preferable if its explicit patent framework matters; no license is appropriate only if restricting reuse is intentional. Approval of MIT should mean accepting commercial reuse and closed derivatives.

Reuse ambiguity risk: likelihood 3 × impact 2 = **6, medium**, where impact 2 means confusing expectations rather than business-threatening loss. Mitigation is easy: verify ownership, select a license and add the exact text before publication. This is an editorial risk estimate, not a legal finding.

The approved standard MIT text is in LICENSE and all workspace packages declare MIT. Dependency/asset notices remain separate: Manrope uses OFL and Lucide uses ISC with Feather portions under MIT. The project license does not replace those notices.
