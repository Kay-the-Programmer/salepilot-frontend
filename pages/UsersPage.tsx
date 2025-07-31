
import React, { useState, useMemo } from 'react';
import { User } from '../types';
import Header from '../components/Header';
import UserList from '../components/users/UserList';
import UserFormModal from '../components/users/UserFormModal';
import UserDetailsView from '../components/users/UserDetailsView';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import { SnackbarType } from '../App';

interface UsersPageProps {
    users: User[];
    onSaveUser: (user: Omit<User, 'id'>, id?: string) => void;
    onDeleteUser: (userId: string) => void;
    showSnackbar: (message: string, type?: SnackbarType) => void;
    isLoading: boolean;
    error: string | null;
}

const UsersPage: React.FC<UsersPageProps> = ({ users, onSaveUser, onDeleteUser, showSnackbar, isLoading, error }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const handleOpenAddModal = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSave = (user: Omit<User, 'id'>, id?: string) => {
        onSaveUser(user, id);
        handleCloseModal();
        // If we are editing the currently viewed user, we don't want to go back to the list
        if (!id) {
            setSelectedUserId(null);
        }
    };
    
    const handleDeleteUser = (userId: string) => {
        onDeleteUser(userId);
        setSelectedUserId(null); // Go back to list after deletion
    };
    
    const handleSelectUser = (userId: string) => {
        setSelectedUserId(userId);
    };

    const handleBackToList = () => {
        setSelectedUserId(null);
    };

    const filteredUsers = useMemo(() => users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    ), [users, searchTerm]);
    
    const selectedUser = useMemo(() => 
        users.find(u => u.id === selectedUserId), 
        [users, selectedUserId]
    );

    if (selectedUser) {
        return (
            <div className="flex flex-col h-full">
                <header className="bg-white shadow-sm z-10">
                    <div className="mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center h-16">
                            <button
                                onClick={handleBackToList}
                                className="mr-4 p-2 rounded-full hover:bg-gray-100"
                                aria-label="Back to user list"
                            >
                                <ArrowLeftIcon className="w-6 h-6 text-gray-600" />
                            </button>
                            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate">
                                {selectedUser.name}
                            </h1>
                        </div>
                    </div>
                </header>
                 <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
                    <UserDetailsView
                        user={selectedUser}
                        onEdit={handleOpenEditModal}
                        onDelete={handleDeleteUser}
                    />
                </main>
                <UserFormModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSave={handleSave}
                    userToEdit={editingUser}
                    showSnackbar={showSnackbar}
                />
            </div>
        )
    }


    return (
        <>
            <Header
                title="User Management"
                buttonText="Add User"
                onButtonClick={handleOpenAddModal}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
            />
            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
                <UserList
                    users={filteredUsers}
                    onSelectUser={handleSelectUser}
                    onEdit={handleOpenEditModal}
                    onDelete={onDeleteUser}
                    isLoading={isLoading}
                    error={error}
                />
            </main>
            <UserFormModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSave}
                userToEdit={editingUser}
                showSnackbar={showSnackbar}
            />
        </>
    );
};

export default UsersPage;
