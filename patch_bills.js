const fs = require('fs');
let file = fs.readFileSync('src/pages/Bills.tsx', 'utf8');

// Hide add button
file = file.replace(
  '<button\n          onClick={() => setIsAddModalOpen(true)}',
  '{permission === \'edit\' && (\n        <button\n          onClick={() => setIsAddModalOpen(true)}'
);
file = file.replace(
  'Nova Conta\n        </button>',
  'Nova Conta\n        </button>\n        )}'
);

// Hide pay button on cards
file = file.replace(
  /<button\n\s*onClick={\(\) => {\n\s*setSelectedBill\(bill\);\n\s*setIsPayModalOpen\(true\);\n\s*}}\n\s*className="flex items-center/g,
  '{permission === \'edit\' && (<button\n                          onClick={() => {\n                            setSelectedBill(bill);\n                            setIsPayModalOpen(true);\n                          }}\n                          className="flex items-center'
);
file = file.replace(
  /Pagar\n\s*<\/button>/g,
  'Pagar\n                        </button>)}'
);

// Hide action buttons container on cards
file = file.replace(
  /<div className="flex items-center gap-2">\n\s*<button\n\s*onClick={\(\) => {\n\s*setSelectedBill\(bill\);\n\s*setFormData/g,
  '{permission === \'edit\' && (<div className="flex items-center gap-2">\n                        <button\n                          onClick={() => {\n                            setSelectedBill(bill);\n                            setFormData'
);
file = file.replace(
  /title="Remover"\n\s*>\n\s*<Trash2 size={20} \/>\n\s*<\/button>\n\s*<\/div>/g,
  'title="Remover"\n                        >\n                          <Trash2 size={20} />\n                        </button>\n                      </div>)}'
);

fs.writeFileSync('src/pages/Bills.tsx', file);
