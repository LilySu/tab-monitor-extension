from dotenv import load_dotenv
from pathlib import Path

import os

def get_repo_root():
	"""
	Returns the absolute path to the repository root directory.
	This is the directory that contains .env, .env.example and the pytabmonitor directory.
	
	Assuming file structure won't change, this is always 2 levels up from this script.
	"""
	# Start from the directory containing this file and go up 2 levels
	current_path = Path(__file__).resolve()  # The script file itself
	parent_dir = current_path.parent         # Utilities directory
	pytabmonitor_dir = parent_dir.parent     # pytabmonitor directory
	repo_root = pytabmonitor_dir.parent      # Repository root
	
	return repo_root

def load_environment_file(env_file_path=None):
	"""
	Run this to load into the environment the variables in the .env file.
	If no path is provided, automatically looks for .env at the repo root.
	"""
	if env_file_path is None:
		env_file_path = get_repo_root() / ".env"
	
	load_dotenv(env_file_path)
	print(f"Loaded environment from: {env_file_path}")

def get_environment_variable(environment_variable_name):
	"""
	Get an environment variable, with optional fallback to .env.example
	"""
	try:
		return os.environ[environment_variable_name]
	except KeyError:
		# If the variable doesn't exist, check if it's in .env.example
		example_env = get_repo_root() / ".env.example"
		if example_env.exists():
			print(f"Warning: {environment_variable_name} not found in environment, checking .env.example")
			load_dotenv(example_env)
			# Try again after loading example
			if environment_variable_name in os.environ:
				return os.environ[environment_variable_name]
		
		# Re-raise the error if we still don't have the variable
		raise KeyError(f"Environment variable {environment_variable_name} not found")