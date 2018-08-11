Steps to deploy
===============

 1. Download JSON events file from Dormcon at https://dormcon.scripts.mit.edu:444/events/programs/rex2018/json (certs required)
 2. Run fix_dates.py on the data to make the dates in the JSON file ISO-compliant (critical)
 3. fix_dates.py will also give you a chunk of pre-gernerated HTML that you can paste into index.html at line 118
 4. Esure JSON_URL at the top of events.js points to the correct JSON events file.