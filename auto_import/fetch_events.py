import argparse
import datetime
import json
import logging
import os.path
import pytz
import requests
import socket
import toml

def __main__():
    """ Main entry point. """
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=str, required=True, help="Configuration TOML file.")
    parser.add_argument("--dryrun", action="store_true",
                        help="Pull JSON but don't copy to web directory.")
    parser.add_argument("--verbose", action="store_true", help="Extra output")
    args = parser.parse_args()

    # Logger
    logging.basicConfig(
        format='%(asctime)s %(levelname)-8s %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S')
    log = logging.getLogger()
    if args.verbose:
        log.setLevel(logging.DEBUG)
    else:
        log.setLevel(logging.INFO)

    log.debug("Starting up event fetcher")

    # Config
    try:
        with open(args.config, "r") as f_config:
            config = toml.load(f_config)
    except Exception as err:
        log.error("Error loading the config file '{}': {}".format (
            args.config,
            str(err)
        ))
        exit(1)

    for field in ("dormcon_url", "certificate_path", "web_path", "timezone"):
        if field not in config:
            log.error("Config file does not define mandatory field `{}`".format(field))
            exit(1)

    # Do Web Request
    try:
        req = requests.get(config["dormcon_url"], cert=config["certificate_path"])
        req.raise_for_status()
    except requests.exceptions.RequestException as err:
        log.error("Error while downloading events file: {}".format(str(err)))
        exit(1)

    try:
        json_data = json.loads(req.content)
    except json.decoder.JSONDecodeError as err:
        # Report parse error and save the file for analysis.
        log.error("Could not decode JSON file: {}".format(str(err)))
        if "json_log_dir" in config:
            path = os.path.join(
                config["json_log_dir"],
                datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S.json")
            )
            try:
                with open(path, "w") as f:
                    f.write(req.content.decode("utf-8"))
                log.info("Wrote malformed file to {}".format(path))
            except Exception as err:
                log.error("Could not save copy of malformed JSON file at {}: {}".format (
                    path,
                    str(err)
                ))
        exit(1)

    log.info("JSON file contains {} events".format(len(json_data)))

    if "min_events" in config and len(json_data) < config["min_events"]:
        # Fail-safe: don't proceed if there are too few events in JSON file (indicitive of an error somewhere)
        log.error("Number of events is below fail-safe ({}). Aborting.".format(config["min_events"]))
        exit(1)

    # Correct dates. Dormcon provides timestamps in the form "2019-08-23T12:00:00", eastern time. Convert
    # these to UTC.
    DORMCON_TIME_FMT = "%Y-%m-%dT%H:%M:%S"
    events_output = []
    for evt in json_data:
        evt["starttime"] = apply_utc_offset(evt["starttime"], config["timezone"])
        evt["endtime"]   = apply_utc_offset(evt["endtime"], config["timezone"])
        events_output.append(evt)

    log.info("Converted dates for {} events.".format(len(events_output)))

    if "min_events" in config and len(json_data) < config["min_events"]:
        # Fail-safe: don't proceed if there are too few events in JSON file (indicitive of an error somewhere)
        log.error("Number of events is below fail-safe ({}). Aborting.".format(config["min_events"]))
        exit(1)

    # Write into web directory
    if not args.dryrun:
        try:
            with open(config["web_path"], "w") as f:
                json.dump(events_output, f)
        except Exception as err:
            log.error("Error while writing JSON file to web: {}".format(str(err)))
            exit(1)
    else:
        log.info("Not saving file to web due to --dryrun")

    log.info("Done.")

def apply_utc_offset(local_time_str, tz_name):
    DORMCON_TIME_FMT = "%Y-%m-%dT%H:%M:%S"
    tz = pytz.timezone(tz_name)
    local = datetime.datetime.strptime(local_time_str, DORMCON_TIME_FMT)

    return tz.localize(local).isoformat()

if __name__ == "__main__":
    __main__()