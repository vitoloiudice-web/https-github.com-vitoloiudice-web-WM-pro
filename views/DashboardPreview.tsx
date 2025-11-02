import React, { useState, useMemo, useEffect } from 'react';
import Card, { CardContent, CardHeader } from '../components/Card';
import Modal from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import Input from '../components/Input';
import Select from '../components/Select';
import { PlusIcon, PencilIcon, TrashIcon, UserCircleIcon, CakeIcon, StarIcon } from '../components/icons/HeroIcons';
import type { Parent, Child, Workshop, Registration, Payment, Location, CustomInscriptionType, InscriptionType } from '../types';

interface DashboardPreviewProps {
    parents: Parent[];
    addParent: (parent: Omit<Parent, 'id'>) => Promise<void>;
    updateParent: (id: string, updates: Partial<Parent>) => Promise<void>;
    removeParent: (id: string) => Promise<void>;
    children: Child[];
    addChild: (child: Omit<Child, 'id'>) => Promise<void>;
    updateChild: (id: string, updates: Partial<Child>) => Promise<void>;
    removeChild: (id: string) => Promise<void>;
    workshops: Workshop[];
    registrations: Registration[];
    addRegistration: (reg: Omit<Registration, 'id'>) => Promise<void>;
    removeRegistration: (id: string) => Promise<void>;
    payments: Payment[];
    addPayment: (payment: Omit<Payment, 'id'>) => Promise<void>;
    locations: Location[];
    inscriptionTypes: CustomInscriptionType[];
}

type ParentModalState = { mode: 'new' } | { mode: 'edit', parent: Parent } | null;
type ChildModalState = { mode: 'new', parentId: string } | { mode: 'edit', child: Child } | null;
type RegistrationModalState = { childId: string } | null;
type RegistrationFormState = Partial<Registration> & {
    recordPayment?: boolean;
    paymentAmount?: number;
    paymentDate?: string;
    paymentMethod?: 'bonifico' | 'contanti' | 'carta';
};
type ParentWithPaymentStatus = Parent & { paymentStatus: 'pagato' | 'non pagato' };


const StarRating = ({ rating, interactive = false, onRatingChange }: { rating: number, interactive?: boolean, onRatingChange?: (newRating: number) => void }) => (
    <div className="flex items-center">
        {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => interactive && onRatingChange?.(star)} className={`focus:outline-none ${interactive ? 'cursor-pointer' : ''}`}>
                <StarIcon className={`h-5 w-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`} solid={star <= rating} />
            </button>
        ))}
    </div>
);


const DashboardPreview = (props: DashboardPreviewProps) => {
    const [filters, setFilters] = useState({
        parentName: '',
        status: '',
        sortBy: 'cognome-az',
        minRating: 0,
        paymentStatus: ''
    });
    const [parentModal, setParentModal] = useState<ParentModalState>(null);
    const [childModal, setChildModal] = useState<ChildModalState>(null);
    const [registrationModal, setRegistrationModal] = useState<RegistrationModalState>(null);
    const [deletingItem, setDeletingItem] = useState<{ type: 'parent' | 'child' | 'registration', id: string, name: string } | null>(null);

    const [parentForm, setParentForm] = useState<Partial<Parent>>({});
    const [childForm, setChildForm] = useState<Partial<Child>>({});
    const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>({});
    
    const locationMap = useMemo(() => new Map(props.locations.map(loc => [loc.id, loc])), [props.locations]);
    const inscriptionTypeMap = useMemo(() => new Map(props.inscriptionTypes.map(it => [it.name, it])), [props.inscriptionTypes]);

    const parentsWithPaymentStatus = useMemo<ParentWithPaymentStatus[]>(() => {
        return props.parents.map(parent => {
            const familyChildrenIds = props.children.filter(c => c.parentId === parent.id).map(c => c.id);
            const familyRegistrations = props.registrations.filter(r => familyChildrenIds.includes(r.childId));
            
            const totalDue = familyRegistrations.reduce((sum, reg) => {
                const typeDetails = inscriptionTypeMap.get(reg.inscriptionType);
                return sum + (typeDetails?.price || 0);
            }, 0);

            const totalPaid = props.payments.filter(p => p.parentId === parent.id).reduce((sum, p) => sum + p.amount, 0);

            return {
                ...parent,
                paymentStatus: totalPaid >= totalDue ? 'pagato' : 'non pagato'
            };
        });
    }, [props.parents, props.children, props.registrations, props.payments, inscriptionTypeMap]);

    const filteredAndSortedParents = useMemo(() => {
        let processedParents = [...parentsWithPaymentStatus];

        // Filtering
        processedParents = processedParents.filter(parent => {
            const filterParentName = filters.parentName.trim().toLowerCase();
            if (filterParentName && !(parent.name.toLowerCase().includes(filterParentName) || parent.surname.toLowerCase().includes(filterParentName))) return false;
            if (filters.status && parent.status !== filters.status) return false;
            if (filters.minRating > 0 && (parent.rating || 0) < filters.minRating) return false;
            if (filters.paymentStatus && parent.paymentStatus !== filters.paymentStatus) return false;
            return true;
        });

        // Sorting
        processedParents.sort((a, b) => {
            switch (filters.sortBy) {
                case 'cognome-az': return a.surname.localeCompare(b.surname);
                case 'cognome-za': return b.surname.localeCompare(a.surname);
                case 'rating-desc': return (b.rating || 0) - (a.rating || 0);
                case 'rating-asc': return (a.rating || 0) - (b.rating || 0);
                default: return 0;
            }
        });

        return processedParents;
    }, [filters, parentsWithPaymentStatus]);
    
    useEffect(() => {
        if (parentModal?.mode === 'edit') setParentForm(parentModal.parent);
        else setParentForm({ status: 'prospect', clientType: 'persona fisica' });
    }, [parentModal]);

    useEffect(() => {
        if (childModal?.mode === 'edit') setChildForm(childModal.child);
        else if (childModal?.mode === 'new') setChildForm({ parentId: childModal.parentId });
    }, [childModal]);

    useEffect(() => {
        if (registrationModal) {
            setRegistrationForm({ 
                childId: registrationModal.childId, 
                status: 'confermata',
                recordPayment: false,
                paymentDate: new Date().toISOString().substring(0,10),
                paymentMethod: 'contanti',
            });
        }
    }, [registrationModal]);

    useEffect(() => {
        if (registrationForm.inscriptionType) {
            const details = inscriptionTypeMap.get(registrationForm.inscriptionType);
            if (details) setRegistrationForm(prev => ({ ...prev, paymentAmount: details.price }));
        }
    }, [registrationForm.inscriptionType, inscriptionTypeMap]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ parentName: '', status: '', sortBy: 'cognome-az', minRating: 0, paymentStatus: '' });
    };

    // --- CRUD Handlers ---
    const handleSaveParent = async (e: React.FormEvent) => { e.preventDefault(); if (parentModal?.mode === 'edit') { await props.updateParent(parentModal.parent.id, parentForm); } else { await props.addParent(parentForm as Omit<Parent, 'id'>); } setParentModal(null); };
    const handleSaveChild = async (e: React.FormEvent) => { e.preventDefault(); if (childModal?.mode === 'edit') { await props.updateChild(childModal.child.id, childForm); } else { await props.addChild(childForm as Omit<Child, 'id'>); } setChildModal(null); };
    const handleSaveRegistration = async (e: React.FormEvent) => { e.preventDefault(); const details = inscriptionTypeMap.get(registrationForm.inscriptionType!); if (!details) return; let endDate: string | undefined; if (details.durationMonths > 0) { const d = new Date(); endDate = new Date(d.setMonth(d.getMonth() + details.durationMonths)).toISOString(); } await props.addRegistration({ childId: registrationForm.childId!, workshopId: registrationForm.workshopId!, registrationDate: new Date().toISOString(), inscriptionType: details.name, inscriptionEndDate: endDate, status: 'confermata' }); if (registrationForm.recordPayment && registrationForm.paymentAmount) { const parentId = props.children.find(c => c.id === registrationForm.childId)?.parentId; if (parentId) await props.addPayment({ parentId, amount: registrationForm.paymentAmount, paymentDate: new Date(registrationForm.paymentDate!).toISOString(), method: registrationForm.paymentMethod!, description: `Iscrizione ${details.name}` }); } setRegistrationModal(null); };
    const handleConfirmDelete = async () => { if (!deletingItem) return; switch(deletingItem.type) { case 'parent': await props.removeParent(deletingItem.id); break; case 'child': await props.removeChild(deletingItem.id); break; case 'registration': await props.removeRegistration(deletingItem.id); break; } setDeletingItem(null); };
    // --- Render Modals (condensed for brevity) ---
    const renderParentModal = () => ( <Modal isOpen={!!parentModal} onClose={() => setParentModal(null)} title={parentModal?.mode === 'new' ? 'Nuovo Cliente' : 'Modifica Cliente'}> <form onSubmit={handleSaveParent} className="space-y-4"> <Select id="status" label="Status" value={parentForm.status || ''} onChange={e => setParentForm({...parentForm, status: e.target.value as Parent['status']})} options={[{value: 'attivo', label: 'Attivo'}, {value: 'sospeso', label: 'Sospeso'}, {value: 'prospect', label: 'Prospect'}, {value: 'cessato', label: 'Cessato'}]} required/> <div className="grid grid-cols-2 gap-4"> <Input id="name" label="Nome" value={parentForm.name || ''} onChange={e => setParentForm({...parentForm, name: e.target.value})} required/> <Input id="surname" label="Cognome" value={parentForm.surname || ''} onChange={e => setParentForm({...parentForm, surname: e.target.value})} required/> </div> <Input id="email" label="Email" type="email" value={parentForm.email || ''} onChange={e => setParentForm({...parentForm, email: e.target.value})} required/> <Input id="phone" label="Telefono" type="tel" value={parentForm.phone || ''} onChange={e => setParentForm({...parentForm, phone: e.target.value})} required/> <div><label className="block text-sm font-medium text-testo-input mb-1">Rating</label><StarRating rating={parentForm.rating || 0} interactive onRatingChange={(r) => setParentForm({...parentForm, rating: r})} /></div> <div className="flex justify-end space-x-3 pt-4"><button type="submit" className="px-4 py-2 bg-bottone-salvataggio text-white rounded-md">Salva</button></div> </form> </Modal> );
    const renderChildModal = () => ( <Modal isOpen={!!childModal} onClose={() => setChildModal(null)} title={childModal?.mode === 'new' ? 'Aggiungi Bambino' : 'Modifica Bambino'}> <form onSubmit={handleSaveChild} className="space-y-4"> <div className="grid grid-cols-2 gap-4"> <Input id="name" label="Nome" value={childForm.name || ''} onChange={e => setChildForm({...childForm, name: e.target.value})} required/> <Input id="surname" label="Cognome" value={childForm.surname || ''} onChange={e => setChildForm({...childForm, surname: e.target.value})} required/> </div> <Input id="birthDate" label="Data di Nascita" type="date" value={childForm.birthDate ? childForm.birthDate.substring(0,10) : ''} onChange={e => setChildForm({...childForm, birthDate: new Date(e.target.value).toISOString()})}/> <div className="flex justify-end space-x-3 pt-4"><button type="submit" className="px-4 py-2 bg-bottone-salvataggio text-white rounded-md">Salva</button></div> </form> </Modal> );
    const renderRegistrationModal = () => ( <Modal isOpen={!!registrationModal} onClose={() => setRegistrationModal(null)} title="Iscrivi a Workshop"> <form onSubmit={handleSaveRegistration} className="space-y-4"> <Select id="workshopId" label="Workshop" value={registrationForm.workshopId || ''} onChange={e => setRegistrationForm({...registrationForm, workshopId: e.target.value})} options={props.workshops.map(w => ({value: w.id, label: w.code}))} required placeholder="Seleziona workshop"/> <Select id="inscriptionType" label="Tipo Iscrizione" value={registrationForm.inscriptionType || ''} onChange={e => setRegistrationForm({...registrationForm, inscriptionType: e.target.value as InscriptionType})} options={props.inscriptionTypes.map(it => ({value: it.name, label: `${it.name} - €${it.price}`}))} required placeholder="Seleziona tipo"/> <div className="pt-4 border-t border-black/10"> <div className="flex items-center"> <input id="recordPayment" type="checkbox" checked={registrationForm.recordPayment || false} onChange={e => setRegistrationForm(prev => ({ ...prev, recordPayment: e.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-bottone-azione focus:ring-bottone-azione"/> <label htmlFor="recordPayment" className="ml-2 block text-sm font-medium text-testo-input">Registra Pagamento Contestuale</label> </div> {registrationForm.recordPayment && ( <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-md border"> <Input id="paymentAmount" label="Importo Pagato (€)" type="number" step="0.01" value={registrationForm.paymentAmount || ''} onChange={e => setRegistrationForm(prev => ({ ...prev, paymentAmount: Number(e.target.value) }))} required/> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> <Input id="paymentDate" label="Data Pagamento" type="date" value={registrationForm.paymentDate || ''} onChange={e => setRegistrationForm(prev => ({ ...prev, paymentDate: e.target.value }))} required/> <Select id="paymentMethod" label="Metodo" value={registrationForm.paymentMethod || 'contanti'} onChange={e => setRegistrationForm(prev => ({ ...prev, paymentMethod: e.target.value as any }))} options={[{value: 'bonifico', label: 'Bonifico'}, {value: 'contanti', label: 'Contanti'}, {value: 'carta', label: 'Carta'}]} required/> </div> </div> )} </div> <div className="flex justify-end space-x-3 pt-4"><button type="submit" className="px-4 py-2 bg-bottone-salvataggio text-white rounded-md">Iscrivi</button></div> </form> </Modal> );

    return (
        <div className="flex flex-col h-full">
            <h2 className="text-xl font-semibold text-testo-input mb-4">Menu Clienti</h2>
            
            <Card className="flex-shrink-0 mb-4">
                <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input label="Cerca Cliente" name="parentName" value={filters.parentName} onChange={handleFilterChange} placeholder="Nome o cognome..."/>
                        <Select label="Status" name="status" value={filters.status} onChange={handleFilterChange} options={[{value: 'attivo', label: 'Attivo'}, {value: 'sospeso', label: 'Sospeso'}, {value: 'prospect', label: 'Prospect'}, {value: 'cessato', label: 'Cessato'}]} placeholder="Tutti gli stati" />
                        <Select label="Pagamenti" name="paymentStatus" value={filters.paymentStatus} onChange={handleFilterChange} options={[{value: 'pagato', label: 'Pagato'}, {value: 'non pagato', label: 'Non Pagato'}]} placeholder="Tutti i pagamenti" />
                        <Select label="Ordina per" name="sortBy" value={filters.sortBy} onChange={handleFilterChange} options={[ {value: 'cognome-az', label: 'Cognome (A-Z)'}, {value: 'cognome-za', label: 'Cognome (Z-A)'}, {value: 'rating-desc', label: 'Rating (Migliori)'}, {value: 'rating-asc', label: 'Rating (Peggiori)'} ]} />
                        <div className="col-span-2 lg:col-span-1">
                            <label className="block text-sm font-medium text-testo-input mb-1">Rating Minimo</label>
                            <StarRating rating={filters.minRating} interactive onRatingChange={(r) => setFilters(prev => ({...prev, minRating: r === filters.minRating ? 0 : r}))} />
                        </div>
                         <div className="flex items-end">
                            <button onClick={resetFilters} className="w-full py-2 text-sm text-bottone-azione hover:underline">Resetta filtri</button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-testo-input/80">{filteredAndSortedParents.length} clienti trovati</p>
                 <button onClick={() => setParentModal({ mode: 'new' })} className="bg-bottone-azione text-white px-4 py-2 rounded-full shadow hover:opacity-90 flex items-center space-x-2">
                    <PlusIcon /><span>Nuovo Cliente</span>
                </button>
            </div>

            <div className="flex-grow space-y-4 overflow-y-auto pr-2">
                {filteredAndSortedParents.map(parent => {
                    const familyChildren = props.children.filter(c => c.parentId === parent.id);
                    return (
// FIX: Wrapped Card component in a div and moved the key prop to the div to resolve the TypeScript error.
                        <div key={parent.id}>
                            <Card>
                                <CardContent>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h4 className="font-bold text-lg text-testo-input">{parent.surname} {parent.name}</h4>
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${parent.paymentStatus === 'pagato' ? 'bg-status-attivo-bg text-status-attivo-text' : 'bg-status-cessato-bg text-status-cessato-text'}`}>{parent.paymentStatus}</span>
                                                <span className={`px-2 py-0.5 text-xs rounded-full capitalize 
                                                    ${parent.status === 'attivo' ? 'bg-status-attivo-bg text-status-attivo-text' : 
                                                    parent.status === 'sospeso' ? 'bg-status-sospeso-bg text-status-sospeso-text' : 
                                                    parent.status === 'prospect' ? 'bg-status-prospect-bg text-status-prospect-text' : 
                                                    'bg-status-cessato-bg text-status-cessato-text'}`}>{parent.status}</span>
                                            </div>
                                            <StarRating rating={parent.rating || 0} />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <button onClick={() => setParentModal({ mode: 'edit', parent })} className="p-2 text-testo-input/80 hover:text-bottone-azione rounded-full hover:bg-black/5"><PencilIcon /></button>
                                            <button onClick={() => setDeletingItem({ type: 'parent', id: parent.id, name: `${parent.name} ${parent.surname}`})} className="p-2 text-testo-input/80 hover:text-bottone-eliminazione rounded-full hover:bg-black/5"><TrashIcon /></button>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-black/10">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-semibold text-sm">Bambini</h5>
                                            <button onClick={() => setChildModal({ mode: 'new', parentId: parent.id })} className="text-xs text-bottone-azione font-medium flex items-center space-x-1"><PlusIcon className="h-4 w-4" /><span>Aggiungi</span></button>
                                        </div>
                                        {familyChildren.map(child => {
                                            const childRegistrations = props.registrations.filter(r => r.childId === child.id);
                                            return (
                                                <div key={child.id} className="p-2 bg-white/30 rounded-md mb-2">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center space-x-2"> <UserCircleIcon className="h-5 w-5"/> <span>{child.name} {child.surname}</span> <CakeIcon className="h-4 w-4 text-testo-input/70"/> <span className="text-xs">{new Date(child.birthDate).toLocaleDateString('it-IT')}</span> </div>
                                                        <div> <button onClick={() => setChildModal({ mode: 'edit', child })} className="p-1"><PencilIcon className="h-4 w-4"/></button> <button onClick={() => setDeletingItem({type: 'child', id: child.id, name: `${child.name} ${child.surname}`})} className="p-1"><TrashIcon className="h-4 w-4"/></button> </div>
                                                    </div>
                                                    <div className="mt-2 pl-2">
                                                         <div className="flex justify-between items-center mb-1"> <h6 className="text-xs font-semibold">Iscrizioni</h6> <button onClick={() => setRegistrationModal({ childId: child.id })} className="text-xs text-bottone-azione font-medium">Iscrivi</button> </div>
                                                         {childRegistrations.map(reg => {
                                                            const workshop = props.workshops.find(w => w.id === reg.workshopId);
                                                            const location = locationMap.get(workshop?.locationId || '');
                                                            return (
                                                                <div key={reg.id} className="text-xs flex justify-between items-center py-1">
                                                                    <div className="flex items-center space-x-2">
                                                                        <div className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: location?.color || '#ccc' }}></div>
                                                                        <p>{workshop?.code} - {reg.inscriptionType} (Scad: {reg.inscriptionEndDate ? new Date(reg.inscriptionEndDate).toLocaleDateString('it-IT') : 'N/D'})</p>
                                                                    </div>
                                                                    <button onClick={() => setDeletingItem({type: 'registration', id: reg.id, name: `iscrizione`})} className="p-1 text-gray-400 hover:text-bottone-eliminazione"><TrashIcon className="h-3 w-3"/></button>
                                                                </div>
                                                            )
                                                         })}
                                                         {childRegistrations.length === 0 && <p className="text-xs italic text-gray-500">Nessuna iscrizione attiva.</p>}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    );
                })}
            </div>

            {renderParentModal()}
            {renderChildModal()}
            {renderRegistrationModal()}
            <ConfirmModal isOpen={!!deletingItem} onClose={() => setDeletingItem(null)} onConfirm={handleConfirmDelete} title={`Conferma Eliminazione`}>
                <p>Sei sicuro di voler eliminare {deletingItem?.name}? L'azione è irreversibile.</p>
            </ConfirmModal>
        </div>
    );
};

export default DashboardPreview;