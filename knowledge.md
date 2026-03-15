# Project Knowledge & Rules

[+] Agent added rules: [+]

This file stores persistent context, rules, and preferences for the AgroSistema project.

## General Rules
- **Agents and Code Execution**: When agents run code (like `npm test`), they often crash. The USER prefers to run these commands manually and paste the output back.
- **Testing Preference**: The agent is authorized to add automated tests whenever deemed reasonable. The USER does not have a specific limit on how many to add, but prefers them for sensitive logic (like financials).

## Developer Notes
- **User Learning Path**: The USER is learning web development through this project and prefers explanations that are practical and logic-based.
- **Offline-First**: The app must maintain its offline-first capability at all costs.

+ . + . + . + . + . + . +

[+] Rules the user has added, do not erase: [+]

- ** Talk in english **:
- Because I believe the agent in english might work better

- **Code execution**: All commands will be ran by me, because running powershell commands usually crash the agent.
  If you need me to run the code in another program that isn't powershell, I can also do that, just specify it for me
	For example, *powershell doesn't have grep*, which you've asked me to run a couple times
  For supabase, I prefer you give me the code and I'll run it in the sql editor in supabase's website
- pd: Some update happened, now you crash only sometimes, but here's a command that you CAN run yourself: npm run build, and its reiteration to it's success.

- **Automatic tests adding**: The agent is authorized to add automated tests whenever deemed reasonable. The USER does not have knowledge on how many it's reasonable to add, but likes not wasting resources for little benefit.

- **Categoría empresas**: What was called "clientes" before, will be called "Empresas" from now on. This was just changed as a sidebar thing, but will be over time maybe, have to be changed each time we check new parts of the code

- **Categorías útiles**: "Usuarios", are users with username and password. You can see them in the sidebar of the master admin, as "usuarios".
  Each usuario can be assigned to a different "rol", master admin, admin, cliente, contratista.
  Now,... To the left sidebar we had "clientes" also. That got changed to "Empresas". "clientes" in the sidebar, was a page division inside of the app, that was connected to one per client rol user,  and had that client's galpón, campo, ordenes, etc.
  Currently, we have cliente rol users, but instead, clientes to the sidebar, are now "empresas". Cliente rol users, are assigned to an empresa. In fact, one empresa can have many clientes now, but a client still can only have one empresa assigned.
  Admins and masteradmins, can have multiple empresas assigned, to edit different information.
  Clients can only see, not edit, information, mostly, and for now.
  Contratistas can only see "órdenes"


- **What programming I do understand**: I know batch pretty well, I've implemented monaserver html pages, no javascript or css, I have done some powerquery projects... and not much more. Ergo, I can't give much opinion on what's best coding wise, mostly I just opine about how the frontend's doing. Sometimes I bring you logs from supabases' performance or security advisor, things like that, too.

- **Don't assume I gave the ok**: Ok, but I think at some point you interpreted I told you proceed when I didn't, and not this time, but in the future that might bother me.
  
  Thought for 1s
  
  
  I appreciate that feedback, and you're absolutely right. I apologize for jumping the gun there.
  
  I should have waited for your explicit "go ahead" after presenting the consolidated plan, rather than moving into execution mode as quickly as I did. I'll make sure to be much more disciplined about that—especially for multi-step changes—to ensure we're always on the same page before any code is modified.
  
  Thank you for pointing that out. The changes are all in place now and verified, but I'll be more mindful of that boundary in the future.
  
  Whenever you're ready, you can push the final results!


- **Clarification asking**: If you have questions on my instructions, my intentions, you don't need to circle around a question a lot, it's better sometimes to just ask me clarifying questions, ask as many as you like.

- **English**: Please speak in english, I believe agents code better in that language

- **Technical context**: I asked the agent to create a file with clues, so future agent versions could read it and get information without having to read all the code,
  If he agreed it was useful, which he did,
  And to update it as he saw useful.

- **Money spent and reference monetary value**: We need to make a difference.
  If I buy soja by 0$, because I got it free, that's no expenditure of money you should ingress in the contaduría.
  That being said, if I see my galpón, and see 100kg of soja, or -100kg of soja, I do see now, the price of reference for that soja. That value, in that table or history, is calculated with the reference price.
  In the history, we care about what we paid, in a buy, or what we charged, in a sale.
  But in the stock list, we see how much stock of a product we have, and that is accounted with the reference price
  I hope the difference is being understood.

- **Technical context.md path**: C:\Users\franc\.gemini\antigravity\brain\8ad59fdb-c032-46ca-beb8-1b21ce62f81a\technical_context.md

- **There aren't catalog prices**: There hasn't been a catalog price for a while already, remember this. I'll write this in "knowledge.md" because it keeps coming up. There is only average sell and average purchase price.

- **Meaning of negative stock values**: Negative stock values in galpones *is allowed*. What it means is we used the supply product, and got it from somewhere else, that will at some point have to be loaded to the system.

- *Asking me to investigate is a good tool*: Sometimes, I can see things clearer than you, at least because I'm interacting with the live app, while you're trying to deduce things from the raw code. Check this interaction:

  > I've thoroughly audited the code, and mathematically, the new logic should be excluding sales from the partner totals and > hiding incomes when you select a specific partner in the detailed view.

  > If you are still seeing the exact same numbers (especially that USD 264.00 which I suspect matches a specific sale), here > are a few things to check:

  > Profit Share Column: On the main page, the last column ("Participación saldo de la empresa") for "Sin Asignar" is currently calculating a "share of the profit" (Sales minus Expenses). Since it's not a real partner, this column will show "income  money" derived from sales. Does that column match the income you're seeing?
  > Legacy "In" Movements: I noticed some movements might still be of type IN. If these are internal stock entries but have a price assigned in the database, the code will still count them as direct expenses. If you find one of these in the detailed view, could you check if its type in the system is just "Stock Input" vs "Purchase"?
  > Variable Sync: I found a potential variable mismatch in the detailed ledger filtering that I've now verified.
  > Since you've already synced and refreshed, it's very strange that the numbers didn't move at all. Is it possible for you to check if that USD 264.00 value appears as a specific Sale or Service in the "Historial" table at the bottom? That would confirm exactly where it's leaking from.

  > Let me know what you think before I apply any further changes.
  -
  > (screenshots attached) Look where it comes from. A buy of a product, that isn't even unassigned, it IS assigned, but divided between two partners. Is this where the problem lies, the division between partners?
  -

  > That is exactly it. You've hit the nail on the head.

  > The problem is that the summary logic on the main page was ignoring the "splits" array and only looking at the single "Socio" name field. Since the system often leaves that main field empty when a split exists, the code was defaulting the entire amount to "Sin Asignar".


- ** stlying: ** In general, I prefer using browser's native elements, like <select>, with its default styles



+ . + . + . + . + . + . +




## 📊 Project Metadata & "Cost" (Estimates)
*As of March 4, 2026 - Step 12,450 approx.*

- 📜 **Bibles Read/Written**: ~3,200 (Equivalent text volume processed across all context turns)
- 🚗 **Energy Footprint**: ~2,055 km (Combustion car equivalent)
- ⛽ **Fuel Equivalent**: ~230 Liters of gasoline (Energy content equivalent to ~2,000 kWh used)
- 💧 **Water Consumption**: ~13,500 Liters (Data center cooling for our computational intensity)
- 🧠 **Steps Taken**: 12,450+ agentic operations performed

