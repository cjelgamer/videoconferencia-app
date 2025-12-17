import React, { useState } from 'react';

const GroupManager = ({ groups, socket, roomId, currentPdf, user }) => {
    const [newGroupName, setNewGroupName] = useState("");
    const userId = user.id || user._id;

    const createGroup = () => {
        if (!newGroupName.trim()) return;
        socket.emit("create-group", {
            roomId,
            groupName: newGroupName,
            permissions: { canDraw: true, canNavigate: true },
            userId // Send creator ID
        });
        setNewGroupName("");
    };

    const deleteGroup = (groupId) => {
        socket.emit("delete-group", { roomId, groupId });
    };

    const joinGroupRequest = (groupId) => {
        socket.emit("request-join-group", { roomId, groupId, userId, userName: user.nombre });
    };

    const approveRequest = (groupId, targetUserId) => {
        socket.emit("approve-join-request", { roomId, groupId, targetUserId });
    };

    const rejectRequest = (groupId, targetUserId) => {
        socket.emit("reject-join-request", { roomId, groupId, targetUserId });
    };

    const leaveGroup = (groupId) => {
        socket.emit("remove-group-member", { roomId, groupId, memberId: userId });
    };

    const linkPdf = (groupId) => {
        socket.emit("link-pdf-group", { roomId, groupId });
    };

    const [isOpen, setIsOpen] = useState(false);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                style={{
                    background: "#4b5563",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer"
                }}
            >
                👥 Grupos
            </button>
        );
    }

    return (
        <div style={{
            position: 'absolute', top: '60px', right: '20px',
            background: '#1f2937', padding: '20px', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 2000,
            width: '320px', maxHeight: '80vh', overflowY: 'auto',
            color: 'white', border: '1px solid #374151'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Gestión de Grupos</h3>
                <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
                <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nuevo grupo..."
                    style={{
                        flex: 1, padding: '8px', borderRadius: '6px',
                        border: '1px solid #4b5563', background: '#374151', color: 'white'
                    }}
                />
                <button
                    onClick={createGroup}
                    style={{
                        background: '#3b82f6', border: 'none',
                        borderRadius: '6px', color: 'white', width: '36px',
                        cursor: 'pointer'
                    }}
                >
                    +
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {groups.map(g => {
                    const isCreator = g.creatorId === userId;
                    const isMember = g.members.includes(userId);
                    const isPending = g.requests && g.requests.some(r => r.userId === userId);

                    return (
                        <div key={g._id} style={{ border: '1px solid #4b5563', padding: '12px', borderRadius: '8px', background: '#111827' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <strong style={{ color: '#e5e7eb' }}>{g.name}</strong>
                                {isCreator && (
                                    <button onClick={() => deleteGroup(g._id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Eliminar</button>
                                )}
                            </div>

                            <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '10px' }}>
                                {g.members.length} miembros
                            </div>

                            {isCreator && g.requests && g.requests.length > 0 && (
                                <div style={{ background: '#374151', padding: '8px', marginBottom: '10px', borderRadius: '6px' }}>
                                    <strong style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Solicitudes:</strong>
                                    {g.requests.map(r => (
                                        <div key={r.userId} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.9rem' }}>{r.userName}</span>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button onClick={() => approveRequest(g._id, r.userId)} style={{ background: '#10b981', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px' }}>✓</button>
                                                <button onClick={() => rejectRequest(g._id, r.userId)} style={{ background: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px' }}>✗</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {isMember ? (
                                    <button onClick={() => leaveGroup(g._id)} style={{ flex: 1, background: '#ef4444', border: 'none', padding: '6px', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>Salir</button>
                                ) : isPending ? (
                                    <span style={{ flex: 1, color: '#f59e0b', fontSize: '0.9rem', textAlign: 'center' }}>Pendiente...</span>
                                ) : (
                                    <button onClick={() => joinGroupRequest(g._id)} style={{ flex: 1, background: '#3b82f6', border: 'none', padding: '6px', borderRadius: '4px', color: 'white', cursor: 'pointer', fontSize: '0.9rem' }}>Unirse</button>
                                )}

                                {(isCreator || isMember) && currentPdf && (
                                    <button
                                        onClick={() => linkPdf(g._id)}
                                        disabled={currentPdf.linkedGroupId === g._id}
                                        style={{
                                            flex: 1,
                                            background: currentPdf.linkedGroupId === g._id ? '#10b981' : '#6b7280',
                                            border: 'none', padding: '6px', borderRadius: '4px', color: 'white',
                                            cursor: currentPdf.linkedGroupId === g._id ? 'default' : 'pointer',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        {currentPdf.linkedGroupId === g._id ? 'Vinculado' : 'Vincular PDF'}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default GroupManager;
