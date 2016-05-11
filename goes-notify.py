#!/usr/bin/env python
import argparse
import json
import logging
import os

from subprocess import check_output, CalledProcessError
from datetime import datetime

from twilio.rest import TwilioRestClient

ARGS = argparse.ArgumentParser(
    description="Send a text when an earlier GOES appointment is available")
ARGS.add_argument(
    '-c', '--configuration', default='config.json', dest='config',
    help='GOES configuation location')

FORMAT = '%(asctime)-15s %(clientip)s %(user)-8s %(message)s'
logging.basicConfig(format=FORMAT)
LOG = logging.getLogger(__name__)


def run_cmd(command):
    """ Runs a command and returns an array of its results
    :param command: String of a command to run within a shell
    :returns: Dictionary with keys relating to the execution's success
    """
    try:
        ret = check_output(command, shell=True).strip()
        return {'success': True, 'return': ret, 'exception': None}
    except CalledProcessError as exc:
        return {'success': False,
                'return': None,
                'exception': exc,
                'command': command}


def send_sms(config, current_appt, available_appt):
    client = TwilioRestClient(config['twilio_account'], config['twilio_token'])
    to_phone = config['twilio_to_phone']
    from_phone = config['twilio_from_phone']

    message = 'Appointment available on {0}'.format(available_appt)
    client.messages.create(to=to_phone, from_=from_phone, body=message)


def main():
    args = ARGS.parse_args()

    try:
        with open(args.config) as fp:
            config = json.load(fp)
    except Exception as exc:
        LOG.exception('Error reading configuration: {0}'.format(exc))
        raise exc

    current_interview_date = datetime.strptime(
        config['current_interview_date'], '%B %d, %Y')

    # Retrieve next available appointment
    # Format:'July 20, 2015'
    pwd = os.path.dirname(os.path.realpath(__file__))
    phantomjs_path = '/usr/local/bin/phantomjs'
    command = '{0} {1}/runner.phantom.js'.format(
        phantomjs_path, pwd)
    raw_appt = run_cmd(command)['return']

    if raw_appt:
        fmt_appt = datetime.strptime(raw_appt, '%B %d, %Y')
        if fmt_appt < current_interview_date:
            send_sms(config, current_interview_date, fmt_appt)
            msg = 'Found: {0} (Current: {1})'.format(
                fmt_appt, current_interview_date)
            print msg

if __name__ == '__main__':
    main()
