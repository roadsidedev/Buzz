"""
conftest.py — Pytest configuration for radio-runner tests.

Adds the parent directory (scripts/radio-runner/) to sys.path so that
test files can import the modules directly.
"""

import os
import sys

# Add the radio-runner directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
