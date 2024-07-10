figma.showUI(__html__, { width: 2000, height: 1200 });


type CustomVariableAlias = {
  type: 'VARIABLE_ALIAS';
  id: string;
};

type CustomVariableValue = string | number | CustomVariableAlias | { r: number, g: number, b: number, a: number };

interface CustomVariable {
  id: string;
  name: string;
  resolvedType: string;
  valuesByMode?: { [key: string]: CustomVariableValue };
}

async function getAllLocalVariables() {
  const localVariables: CustomVariable[] = await figma.variables.getLocalVariablesAsync() as unknown as CustomVariable[];
  const variableDetails = await Promise.all(localVariables.map(async variable => {
    const [group, name] = parseVariableName(variable.name);
    const details = {
      id: variable.id,
      group,
      name,
      type: variable.resolvedType,
      value: 'undefined',
      alias: 'No',
      usageCount: 0
    };

    if (variable.valuesByMode) {
      const value = Object.values(variable.valuesByMode)[0];
      if ((value as CustomVariableAlias).type === 'VARIABLE_ALIAS') {
        details.value = await getVariableNameById((value as CustomVariableAlias).id);
        details.alias = 'Yes';
        details.usageCount = getUsageCount(localVariables, (value as CustomVariableAlias).id);
      } else {
        details.value = formatValue(variable.resolvedType, value);
      }
    }

    return details;
  }));

  return variableDetails;
}

function parseVariableName(variableName: string): [string, string] {
  const pathParts = variableName.split('/');
  const group = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'Unknown';
  const name = pathParts.length > 1 ? pathParts[pathParts.length - 1] : pathParts[0];
  return [group, name];
}

async function getVariableNameById(id: string): Promise<string> {
  const variable = await figma.variables.getVariableByIdAsync(id);
  return variable?.name || 'Unknown';
}

function getUsageCount(variables: CustomVariable[], id: string): number {
  return variables.reduce((count, variable) => {
    const value = variable.valuesByMode ? Object.values(variable.valuesByMode)[0] : null;
    return count + ((value as CustomVariableAlias)?.type === 'VARIABLE_ALIAS' && (value as CustomVariableAlias).id === id ? 1 : 0);
  }, 0);
}

function formatValue(type: string, value: CustomVariableValue): string {
  if (type === 'COLOR' && typeof value === 'object') {
    const { r, g, b, a } = value as { r: number, g: number, b: number, a: number };
    return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  }
  return value.toString();
}

(async () => {
  const variables = await getAllLocalVariables();
  figma.ui.postMessage({ type: 'variables', variables });
})();
