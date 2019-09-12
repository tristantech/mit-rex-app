# About

The MIT REX app is a lightweight web-based application for viewing Dormcon's REX schedule. It is implemented as a pure HTML/JS static site. Events are stored in a JSON file that gets loaded by the client. Search and filtering happen on-client.

# Automatic event updates

A cron job on the server can be configured to periodically pull new event data from Dormcon's scripts locker and update its JSON file. See `auto_import/`. Be sure to create a configuration file based off the sample.

# Site

The static HTML/JS/CSS site is located in `html/`. Simply point your web server's document root there. Do not serve the `auto_import/` directory.

## Deployment Notes

 * Make sure to update the date filter values in `index.html` just below `<h2>Filter by Date</h2>`.
