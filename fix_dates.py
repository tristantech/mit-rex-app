import json
import datetime

FILE_NAME = "rex2018.json"

data = None
with open(FILE_NAME, "r") as f:
	data = json.load(f)

dates_with_events = set()

for event in data:
	# Append UTC time offset to all times to make it a valid ISO date
	event["starttime"] += "-0400"
	event["endtime"] += "-0400"
	
	d = datetime.datetime.strptime(event["starttime"].split("T")[0], "%Y-%m-%d")
	if d not in dates_with_events:
		dates_with_events.add(d)

with open("corrected_" + FILE_NAME, "w") as f:
	json.dump(data, f)

print "Dates with Events:"
for date in sorted(dates_with_events):
	#print date.strftime("%A %m/%d")
	print "<button onClick=\"App.updateLists({{mode:'day', m:{}, d:{}}});\">{}</button>".format(
		date.month,
		date.day,
		date.strftime("%A %m/%d")
	)
