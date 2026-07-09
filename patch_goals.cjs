const fs = require('fs');
let file = fs.readFileSync('src/pages/Goals.tsx', 'utf8');

file = file.replace(
  '<button \n          onClick={() => setIsAddModalOpen(true)}',
  '{permission === \'edit\' && (\n        <button \n          onClick={() => setIsAddModalOpen(true)}'
);
file = file.replace(
  'Nova Meta\n        </button>',
  'Nova Meta\n        </button>\n        )}'
);

file = file.replace(
  /<button\n\s*onClick={\(\) => handleAddGasto\(goal\.id, goal\.currentAmount\)}/g,
  '{permission === \'edit\' && (<button\n                          onClick={() => handleAddGasto(goal.id, goal.currentAmount)}'
);
file = file.replace(
  /Adicionar Gasto\n\s*<\/button>/g,
  'Adicionar Gasto\n                        </button>)}'
);

file = file.replace(
  /<button \n\s*onClick={\(\) => handleDeleteGoal\(goal\.id\)}/g,
  '{permission === \'edit\' && (<button \n                        onClick={() => handleDeleteGoal(goal.id)}'
);
file = file.replace(
  /title="Remover meta"\n\s*>\n\s*<Trash2 size={20} \/>\n\s*<\/button>/g,
  'title="Remover meta"\n                      >\n                        <Trash2 size={20} />\n                      </button>)}'
);

fs.writeFileSync('src/pages/Goals.tsx', file);
