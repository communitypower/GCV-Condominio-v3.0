import React, { useState } from 'react';
import { Users, Search, Plus, Mail, Phone, Car } from 'lucide-react';

interface Condomino {
  unitId: string;
  name: string;
  phone: string;
  email: string;
  plate: string;
  pet: string;
}

export default function Condominos() {
  const [search, setSearch] = useState('');
  const [list, setList] = useState<Condomino[]>([
    { unitId: 'A-101', name: 'Ana Beatriz Souza', phone: '(11) 98765-4321', email: 'anabeatriz@exemplo.com', plate: 'BRA-3D21', pet: 'Nenhum' },
    { unitId: 'A-102', name: 'Carlos Roberto Lima', phone: '(11) 99822-1100', email: 'carlos.roberto@exemplo.com', plate: 'GCV-4560', pet: 'Gato (Félix)' },
    { unitId: 'A-201', name: 'Juliana Vieira', phone: '(11) 97100-3344', email: 'juliana.vieira@exemplo.com', plate: 'ABC-1234', pet: 'Cão (Bobi)' },
    { unitId: 'B-101', name: 'Ramiro Gonçalves', phone: '(11) 96211-5500', email: 'ramiro@exemplo.com', plate: 'XYZ-9081', pet: 'Cão (Luna)' },
    { unitId: 'B-202', name: 'Mariana Castilho', phone: '(11) 98233-4455', email: 'mari.castilho@exemplo.com', plate: 'KLE-0922', pet: 'Nenhum' }
  ]);

  const [showAdd, setShowAdd] = useState(false);
  const [unitId, setUnitId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [plate, setPlate] = useState('');
  const [pet, setPet] = useState('Nenhum');

  const filtered = list.filter(c => {
    return c.name.toLowerCase().includes(search.toLowerCase()) || 
           c.unitId.toLowerCase().includes(search.toLowerCase()) ||
           c.plate.toLowerCase().includes(search.toLowerCase());
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId.trim() || !name.trim()) {
      alert('Favor preencher a unidade e nome.');
      return;
    }
    const newCond: Condomino = {
      unitId,
      name,
      phone: phone || 'N/D',
      email: email || 'N/D',
      plate: plate || 'Sem veículo',
      pet
    };
    setList([...list, newCond]);
    setShowAdd(false);
    setUnitId('');
    setName('');
    setPhone('');
    setEmail('');
    setPlate('');
    setPet('Nenhum');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
            <span className="text-[#10b981]"><Users className="w-8 h-8" /></span>
            Cadastro Diretor de Condôminos / Moradores
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Consulte contatos, telefones, placas de garagens para identificação de portarias</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#10b981] hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Registrar Morador
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-3.5 text-zinc-500 w-4 h-4" />
        <input 
          type="text" 
          placeholder="Procure moradores por nome completo, apartamento (Ex: A-101) ou placas de carros..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#14161b] border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-[#10b981]"
        />
      </div>

      <div className="bg-[#14161b] rounded-xl border border-zinc-800 overflow-hidden shadow-md">
        <table className="w-full text-xs text-left text-zinc-350">
          <thead className="bg-[#0d0e12]/60 border-b border-zinc-800 text-zinc-400 font-bold">
            <tr>
              <th className="p-4">UNIDADE</th>
              <th className="p-4">MORADOR RESPONSÁVEL</th>
              <th className="p-4">CONTATO TELEFÔNICO</th>
              <th className="p-4">EMAIL CADASTRO</th>
              <th className="p-4">VEÍCULO / PLACA</th>
              <th className="p-4">ANIMAIS (PET)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-850">
            {filtered.map((c, i) => (
              <tr key={i} className="hover:bg-zinc-850/20 transition-colors">
                <td className="p-4 font-mono font-bold text-[#10b981]">{c.unitId}</td>
                <td className="p-4 text-white font-bold">{c.name}</td>
                <td className="p-4 font-mono">{c.phone}</td>
                <td className="p-4 text-zinc-400">{c.email}</td>
                <td className="p-4 font-mono flex items-center gap-1">
                  <Car className="w-3.5 h-3.5 text-zinc-500" />
                  {c.plate}
                </td>
                <td className="p-4 text-zinc-500 font-semibold">{c.pet}</td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">Nenhum morador registrado ou localizado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#14161b] rounded-xl border border-zinc-800 p-6 w-full max-w-md space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
              <h3 className="text-lg font-bold text-white">Cadastrar Morador</h3>
              <button onClick={() => setShowAdd(false)} className="text-zinc-500 text-xs font-mono">fechar</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-semibold">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Apartamento / Unidade</label>
                  <input 
                    type="text" 
                    value={unitId} 
                    onChange={(e) => setUnitId(e.target.value)}
                    placeholder="EX: A-101"
                    className="w-full bg-[#0d0e12] border border-zinc-85c text-white rounded p-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Nome Completo</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="EX: João Silva Santos"
                    className="w-full bg-[#0d0e12] border border-zinc-85c text-white rounded p-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Celular / WhatsApp</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 90000-0000"
                    className="w-full bg-[#0d0e12] border border-zinc-85c text-white rounded p-2 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="EX: joao@gmail.com"
                    className="w-full bg-[#0d0e12] border border-zinc-85c text-white rounded p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Placa do Veículo (Opcional)</label>
                  <input 
                    type="text" 
                    value={plate} 
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="EX: ABC-1234"
                    className="w-full bg-[#0d0e12] border border-zinc-85c text-white rounded p-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-400 block">Pet / Animal doméstico</label>
                  <input 
                    type="text" 
                    value={pet} 
                    onChange={(e) => setPet(e.target.value)}
                    placeholder="Nenhum ou gato/cão"
                    className="w-full bg-[#0d0e12] border border-zinc-85c text-white rounded p-2"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-[#10b981] text-white font-bold uppercase rounded hover:bg-[#009267] transition-all"
              >
                Cadastrar Ficha de Morador
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
