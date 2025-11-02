import React, { useState, useMemo, useEffect } from 'react';
import Card, { CardContent, CardHeader } from '../components/Card';
import Modal from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import Input from '../components/Input';
import Select from '../components/Select';
import { PlusIcon, PencilIcon, TrashIcon, UserCircleIcon, CakeIcon, StarIcon } from '../components/icons/HeroIcons';
import type { Parent, Child, Workshop, Registration, Payment, Location, InscriptionType, CustomInscriptionType } from '../types';

interface ClientsViewProps {
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
    updatePayment: (id: string, updates: Partial<Payment>) => Promise<void>;
    locations: Location[];
    inscriptionTypes: CustomInscriptionType[];
}

type ParentModalState = { mode: 'new' } | { mode: 'edit', parent: Parent } | null;
type ChildModalState = { mode: 'new', parentId: string } | { mode: 'edit', child: Child } | null;
type RegistrationModalState = { childId: string } | null;

// Extends Registration with optional payment fields for the form state
type RegistrationFormState = Partial<Registration> & {
    recordPayment?: boolean;
    paymentAmount?: number;
    paymentDate?: string;
    paymentMethod?: 'bonifico' | 'contanti' | 'carta';
};


const StarRating = ({ rating, onRatingChange }: { rating: number, onRatingChange: (newRating: number) => void }) => (
    <div className="flex items-center">
        {[1, 2, 3, 4, 5].map(star => (
            <button key={star} onClick={() => onRatingChange(star)} className="focus:outline-none">
                <StarIcon className={`h-5 w-5 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`} solid={star <= rating} />
            </button>
        ))}
    </div>
);

const ClientsView = (props: ClientsViewProps) => {
    const [filters, setFilters] = useState({
        childName: '',
        parentName: '',
        parentSurname: '',
        status: ''
    });
    const [parentModal, setParentModal] = useState<ParentModalState>(null);
    const [childModal, setChildModal] = useState<ChildModalState>(null);
    const [registrationModal, setRegistrationModal] = useState<RegistrationModalState>(null);
    const [deletingItem, setDeletingItem] = useState<{ type: 'parent' | 'child' | 'registration', id: string, name: string } | null>(null);

    const [parentForm, setParentForm] = useState<Partial<Parent>>({});
    const [childForm, setChildForm] = useState<Partial<Child>>({});
    const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>({});
    
    const locationMap = useMemo(() => new Map(props.locations.map(loc => [loc.id, loc])), [props.locations]);

    const filteredParents = useMemo(() => {
        return props.parents.filter(parent => {
            const filterParentName = filters.parentName.trim().toLowerCase();
            const filterParentSurname = filters.parentSurname.trim().toLowerCase();
            const filterChildName = filters.childName.trim().toLowerCase();
            const filterStatus = filters.status;

            const parentNameMatch = !filterParentName || parent.name.toLowerCase().includes(filterParentName);
            const parentSurnameMatch = !filterParentSurname || parent.surname.toLowerCase().includes(filterParentSurname);
            const statusMatch = !filterStatus || parent.status === filterStatus;
            
            const childNameMatch = !filterChildName || props.children.some(child => 
                child.parentId === parent.id && 
                (child.name.toLowerCase().includes(filterChildName) || child.surname.toLowerCase().includes(filterChildName))
            );

            return parentNameMatch && parentSurnameMatch && statusMatch && childNameMatch;
        });
    }, [filters, props.parents, props.children]);
    
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

    // Effect to update payment details when inscription type changes
    useEffect(() => {
        if (registrationForm.inscriptionType) {
            const details = props.inscriptionTypes.find(it => it.name === registrationForm.inscriptionType);
            if (details) {
                setRegistrationForm(prev => ({
                    ...prev,
                    paymentAmount: details.price,
                }));
            }
        }
    }, [registrationForm.inscriptionType, props.inscriptionTypes]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({
            childName: '',
            parentName: '',
            parentSurname: '',
            status: ''
        });
    };

    const handleSaveParent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (parentModal?.mode === 'edit') {
            await props.updateParent(parentModal.parent.id, parentForm);
        } else {
            await props.addParent(parentForm as Omit<Parent, 'id'>);
        }
        setParentModal(null);
    };

    const handleSaveChild = async (e: React.FormEvent) => {
        e.preventDefault();
        if (childModal?.mode === 'edit') {
            await props.updateChild(childModal.child.id, childForm);
        } else {
            await props.addChild(childForm as Omit<Child, 'id'>);
        }
        setChildModal(null);
    };
    
    const handleSaveRegistration = async (e: React.FormEvent) => {
        e.preventDefault();
        const inscriptionTypeName = registrationForm.inscriptionType!;
        const details = props.inscriptionTypes.find(it => it.name === inscriptionTypeName);

        if (!details) {
            alert("Errore: tipo di iscrizione non valido.");
            return;
        }

        let endDate: string | undefined = undefined;
        const duration = details.durationMonths;

        if (duration > 0) {
            const startDate = new Date();
            endDate = new Date(startDate.setMonth(startDate.getMonth() + duration)).toISOString();
        }

        const dataToSave: Omit<Registration, 'id'> = {
            childId: registrationForm.childId!,
            workshopId: registrationForm.workshopId!,
            registrationDate: new Date().toISOString(),
            inscriptionType: inscriptionTypeName,
            inscriptionEndDate: endDate,
            durationInMonths: duration > 0 ? duration : undefined,
            status: 'confermata',
        };

        await props.addRegistration(dataToSave);

        // Add payment if requested by user
        if (registrationForm.recordPayment && registrationForm.paymentAmount && registrationForm.paymentAmount > 0) {
            const parentId = props.children.find(c => c.id === registrationForm.childId)?.parentId;
            if (parentId) {
                const payment: Omit<Payment, 'id'> = {
                    parentId,
                    amount: registrationForm.paymentAmount,
                    paymentDate: new Date(registrationForm.paymentDate!).toISOString(),
                    method: registrationForm.paymentMethod!,
                    description: `Iscrizione ${inscriptionTypeName} per ${props.workshops.find(w => w.id === registrationForm.workshopId)?.code}`
                };
                await props.addPayment(payment);
            }
        }

        setRegistrationModal(null);
    };

    const handleConfirmDelete = async () => {
        if (!deletingItem) return;
        switch(deletingItem.type) {
            case 'parent': await props.removeParent(deletingItem.id); break;
            case 'child': await props.removeChild(deletingItem.id); break;
            case 'registration': await props.removeRegistration(deletingItem.id); break;
        }
        setDeletingItem(null);
    };

    const renderParentModal = () => (
        <Modal isOpen={!!parentModal} onClose={() => setParentModal(null)} title={parentModal?.mode === 'new' ? 'Nuovo Cliente' : 'Modifica Cliente'}>
            <form onSubmit={handleSaveParent} className="space-y-4">
                <Select id="status" label="Status" value={parentForm.status || ''} onChange={e => setParentForm({...parentForm, status: e.target.value as Parent['status']})} options={[{value: 'attivo', label: 'Attivo'}, {value: 'sospeso', label: 'Sospeso'}, {value: 'prospect', label: 'Prospect'}, {value: 'cessato', label: 'Cessato'}]} required/>
                <div className="grid grid-cols-2 gap-4">
                    <Input id="name" label="Nome" value={parentForm.name || ''} onChange={e => setParentForm({...parentForm, name: e.target.value})} required/>
                    <Input id="surname" label="Cognome" value={parentForm.surname || ''} onChange={e => setParentForm({...parentForm, surname: e.target.value})} required/>
                </div>
                <Input id="email" label="Email" type="email" value={parentForm.email || ''} onChange={e => setParentForm({...parentForm, email: e.target.value})} required/>
                <Input id="phone" label="Telefono" type="tel" value={parentForm.phone || ''} onChange={e => setParentForm({...parentForm, phone: e.target.value})} required/>
                 <Select id="rating" label="Rating" value={parentForm.rating || ''} onChange={e => setParentForm({...parentForm, rating: Number(e.target.value)})} options={[{value: 1, label: '1 Stella'}, {value: 2, label: '2 Stelle'}, {value: 3, label: '3 Stelle'}, {value: 4, label: '4 Stelle'}, {value: 5, label: '5 Stelle'}]} placeholder="Nessun rating" />
                <div className="flex justify-end space-x-3 pt-4"><button type="submit" className="px-4 py-2 bg-bottone-salvataggio text-white rounded-md">Salva</button></div>
            </form>
        </Modal>
    );

    const renderChildModal = () => (
        <Modal isOpen={!!childModal} onClose={() => setChildModal(null)} title={childModal?.mode === 'new' ? 'Aggiungi Bambino' : 'Modifica Bambino'}>
            <form onSubmit={handleSaveChild} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input id="name" label="Nome" value={childForm.name || ''} onChange={e => setChildForm({...childForm, name: e.target.value})} required/>
                    <Input id="surname" label="Cognome" value={childForm.surname || ''} onChange={e => setChildForm({...childForm, surname: e.target.value})} required/>
                </div>
                <Input id="birthDate" label="Data di Nascita" type="date" value={childForm.birthDate ? childForm.birthDate.substring(0,10) : ''} onChange={e => setChildForm({...childForm, birthDate: new Date(e.target.value).toISOString()})}/>
                <div className="flex justify-end space-x-3 pt-4"><button type="submit" className="px-4 py-2 bg-bottone-salvataggio text-white rounded-md">Salva</button></div>
            </form>
        </Modal>
    );

    const renderRegistrationModal = () => (
         <Modal isOpen={!!registrationModal} onClose={() => setRegistrationModal(null)} title="Iscrivi a Workshop">
            <form onSubmit={handleSaveRegistration} className="space-y-4">
                <Select id="workshopId" label="Workshop" value={registrationForm.workshopId || ''} onChange={e => setRegistrationForm({...registrationForm, workshopId: e.target.value})} options={props.workshops.map(w => ({value: w.id, label: w.code}))} required placeholder="Seleziona workshop"/>
                <Select 
                    id="inscriptionType" 
                    label="Tipo Iscrizione" 
                    value={registrationForm.inscriptionType || ''} 
                    onChange={e => setRegistrationForm({...registrationForm, inscriptionType: e.target.value as InscriptionType})} 
                    options={props.inscriptionTypes.map(it => ({value: it.name, label: `${it.name} - €${it.price}`}))}
                    required 
                    placeholder="Seleziona tipo"
                />
                
                <div className="pt-4 border-t border-black/10">
                    <div className="flex items-center">
                        <input
                            id="recordPayment"
                            type="checkbox"
                            checked={registrationForm.recordPayment || false}
                            onChange={e => setRegistrationForm(prev => ({ ...prev, recordPayment: e.target.checked }))}
                            className="h-4 w-4 rounded border-gray-300 text-bottone-azione focus:ring-bottone-azione"
                        />
                        <label htmlFor="recordPayment" className="ml-2 block text-sm font-medium text-testo-input">
                            Registra Pagamento Contestuale
                        </label>
                    </div>

                    {registrationForm.recordPayment && (
                        <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-md border">
                             <Input 
                                id="paymentAmount" 
                                label="Importo Pagato (€)" 
                                type="number" 
                                step="0.01"
                                value={registrationForm.paymentAmount || ''} 
                                onChange={e => setRegistrationForm(prev => ({ ...prev, paymentAmount: Number(e.target.value) }))}
                                required
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input 
                                    id="paymentDate" 
                                    label="Data Pagamento" 
                                    type="date"
                                    value={registrationForm.paymentDate || ''} 
                                    onChange={e => setRegistrationForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                                    required
                                />
                                <Select
                                    id="paymentMethod"
                                    label="Metodo"
                                    value={registrationForm.paymentMethod || 'contanti'}
                                    onChange={e => setRegistrationForm(prev => ({ ...prev, paymentMethod: e.target.value as any }))}
                                    options={[{value: 'bonifico', label: 'Bonifico'}, {value: 'contanti', label: 'Contanti'}, {value: 'carta', label: 'Carta'}]}
                                    required
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3 pt-4"><button type="submit" className="px-4 py-2 bg-bottone-salvataggio text-white rounded-md">Iscrivi</button></div>
            </form>
        </Modal>
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-testo-input">Clienti</h2>
                <button onClick={() => setParentModal({ mode: 'new' })} className="bg-bottone-azione text-white px-4 py-2 rounded-full shadow hover:opacity-90 flex items-center space-x-2">
                    <PlusIcon /><span>Nuovo Cliente</span>
                </button>
            </div>
            
            <Card>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input label="Nome Bambino" name="childName" value={filters.childName} onChange={handleFilterChange} placeholder="Cerca bambino..."/>
                        <Input label="Nome Genitore" name="parentName" value={filters.parentName} onChange={handleFilterChange} placeholder="Cerca nome..."/>
                        <Input label="Cognome Genitore" name="parentSurname" value={filters.parentSurname} onChange={handleFilterChange} placeholder="Cerca cognome..."/>
                        <Select label="Status" name="status" value={filters.status} onChange={handleFilterChange} options={[
                            {value: 'attivo', label: 'Attivo'}, {value: 'sospeso', label: 'Sospeso'}, 
                            {value: 'prospect', label: 'Prospect'}, {value: 'cessato', label: 'Cessato'}
                        ]} placeholder="Tutti gli stati" />
                    </div>
                    <div className="flex justify-end mt-4">
                        <button onClick={resetFilters} className="text-sm text-bottone-azione hover:underline">Resetta filtri</button>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-4">
                {filteredParents.map(parent => {
                    const familyChildren = props.children.filter(c => c.parentId === parent.id);
                    return (
                        <div key={parent.id}>
                        <Card>
                            <CardContent>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <h4 className="font-bold text-lg text-testo-input">{parent.name} {parent.surname}</h4>
                                            <StarRating rating={parent.rating || 0} onRatingChange={(newRating) => props.updateParent(parent.id, { rating: newRating })} />
                                        </div>
                                        <p className="text-sm text-testo-input/80">{parent.email}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button onClick={() => setParentModal({ mode: 'edit', parent })} className="p-2 text-testo-input/80 hover:text-bottone-azione"><PencilIcon /></button>
                                        <button onClick={() => setDeletingItem({ type: 'parent', id: parent.id, name: `${parent.name} ${parent.surname}`})} className="p-2 text-testo-input/80 hover:text-bottone-eliminazione"><TrashIcon /></button>
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
                                                    <div className="flex items-center space-x-2">
                                                        <UserCircleIcon className="h-5 w-5"/> <span>{child.name} {child.surname}</span>
                                                        <CakeIcon className="h-4 w-4 text-testo-input/70"/> <span className="text-xs">{new Date(child.birthDate).toLocaleDateString('it-IT')}</span>
                                                    </div>
                                                    <div>
                                                        <button onClick={() => setChildModal({ mode: 'edit', child })} className="p-1"><PencilIcon className="h-4 w-4"/></button>
                                                        <button onClick={() => setDeletingItem({type: 'child', id: child.id, name: `${child.name} ${child.surname}`})} className="p-1"><TrashIcon className="h-4 w-4"/></button>
                                                    </div>
                                                </div>
                                                <div className="mt-2 pl-2 border-l-2 border-bottone-azione/30">
                                                     <div className="flex justify-between items-center mb-1">
                                                        <h6 className="text-xs font-semibold">Iscrizioni</h6>
                                                        <button onClick={() => setRegistrationModal({ childId: child.id })} className="text-xs text-bottone-azione font-medium">Iscrivi</button>
                                                     </div>
                                                     {childRegistrations.map(reg => {
                                                        const workshop = props.workshops.find(w => w.id === reg.workshopId);
                                                        const location = locationMap.get(workshop?.locationId || '');
                                                        return (
                                                            <div key={reg.id} className="text-xs flex justify-between items-center">
                                                                <p>{workshop?.code} ({location?.shortName}) - {reg.inscriptionType} (Scad: {reg.inscriptionEndDate ? new Date(reg.inscriptionEndDate).toLocaleDateString('it-IT') : 'N/D'})</p>
                                                                <button onClick={() => setDeletingItem({type: 'registration', id: reg.id, name: `iscrizione a ${workshop?.code}`})} className="p-1"><TrashIcon className="h-3 w-3"/></button>
                                                            </div>
                                                        )
                                                     })}
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

export default ClientsView;