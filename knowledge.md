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

- **Code execution**: All commands will be ran by me, because running powershell commands usually crash the agent.
  If you need me to run the code in another program that isn't powershell, I can also do that, just specify it for me
	For example, *powershell doesn't have grep*, which you've asked me to run a couple times
  For supabase, I prefer you give me the code and I'll run it in the sql editor in supabase's website


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

+ . + . + . + . + . + . +




## 📊 Project Metadata & "Cost" (Estimates)
*As of Jan 27, 2026 - Step 10,700 approx.*

- 📜 **Bibles Read/Written**: ~200 (Equivalent text volume processed across all context turns)
- 🚗 **Energy Footprint**: ~250 km (EV) vs. **~80 km (Combustion car)**
- ⛽ **Fuel Equivalent**: ~6 Liters of gasoline (Energy content equivalent to ~50 kWh used)
- 💧 **Water Consumption**: ~330 Liters (Data center cooling for our computational intensity)
- 🧠 **Steps Taken**: 10,745+ agentic operations performed

