## How to run

```bash
# Schedule runner
cubo_scheduler --folder=./src/commands --debug

# Run specific command once
cubo_scheduler command_name --folder=./src/commands

# Run command with props
cubo_scheduler command_name --folder=./src/commands --prop1=Y --prop2='{"key": "value"}'
```