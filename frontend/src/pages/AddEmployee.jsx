import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEmployee, getDepartments } from '../services/employeeService';
import styles from './AddEmployee.module.css';

const AddEmployee = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        employeeId: '',
        firstName: '',
        lastName: '',
        gender: 'Male',
        dateOfBirth: '',
        phone: '',
        address: '',
        department: '',
        designation: '',
        dateOfJoining: new Date().toISOString().split('T')[0],
        employmentType: 'Full-Time',
        baseSalary: '',
        emergencyContact: {
            name: '',
            relationship: '',
            phone: ''
        }
    });

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const { data } = await getDepartments();
                const depts = data.departments || [];
                setDepartments(depts);
                if (depts.length > 0) {
                    setFormData(prev => ({ ...prev, department: depts[0]._id }));
                }
            } catch (err) {
                console.error('Error fetching departments:', err);
                setError('Failed to load departments. Please refresh.');
            }
        };
        fetchDepts();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('emergency_')) {
            const field = name.split('_')[1];
            setFormData(prev => ({
                ...prev,
                emergencyContact: { ...prev.emergencyContact, [field]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await createEmployee(formData);
            navigate('/hr/employees');
        } catch (err) {
            console.error('Error creating employee:', err);
            setError(err.response?.data?.message || 'Failed to create employee. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Add New Employee</h1>
                <button
                    onClick={() => navigate('/hr/employees')}
                    className={styles.cancelButton}
                    type="button"
                >
                    Back to List
                </button>
            </div>

            <div className={styles.formCard}>
                {error && <div className={styles.errorAlert}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className={styles.formSection}>
                        <h2 className={styles.formSectionTitle}>Personal Information</h2>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>First Name*</label>
                                <input
                                    type="text" name="firstName" value={formData.firstName}
                                    onChange={handleChange} required className={styles.input}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Last Name*</label>
                                <input
                                    type="text" name="lastName" value={formData.lastName}
                                    onChange={handleChange} required className={styles.input}
                                />
                            </div>
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Gender</label>
                                <select
                                    name="gender" value={formData.gender}
                                    onChange={handleChange} className={styles.select}
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label>Date of Birth</label>
                                <input
                                    type="date" name="dateOfBirth" value={formData.dateOfBirth}
                                    onChange={handleChange} className={styles.input}
                                />
                            </div>
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Phone Number</label>
                                <input
                                    type="text" name="phone" value={formData.phone}
                                    onChange={handleChange} className={styles.input}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Address</label>
                                <input
                                    type="text" name="address" value={formData.address}
                                    onChange={handleChange} className={styles.input}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.formSection}>
                        <h2 className={styles.formSectionTitle}>Professional Details</h2>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Employee ID (Leave blank to auto-generate)</label>
                                <input
                                    type="text"
                                    name="employeeId"
                                    value={formData.employeeId}
                                    onChange={handleChange}
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Department*</label>
                                <select
                                    name="department" value={formData.department}
                                    onChange={handleChange} required className={styles.select}
                                >
                                    {departments.map(dept => (
                                        <option key={dept._id} value={dept._id}>{dept.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Designation*</label>
                                <input
                                    type="text" name="designation" value={formData.designation}
                                    onChange={handleChange} required className={styles.input}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Employment Type</label>
                                <select
                                    name="employmentType" value={formData.employmentType}
                                    onChange={handleChange} className={styles.select}
                                >
                                    <option value="Full-Time">Full-Time</option>
                                    <option value="Part-Time">Part-Time</option>
                                    <option value="Contract">Contract</option>
                                    <option value="Intern">Intern</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Base Salary*</label>
                                <input
                                    type="number" name="baseSalary" value={formData.baseSalary}
                                    onChange={handleChange} required className={styles.input}
                                    min="0"
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Date of Joining</label>
                                <input
                                    type="date" name="dateOfJoining" value={formData.dateOfJoining}
                                    onChange={handleChange} className={styles.input}
                                />
                            </div>
                        </div>
                    </div>

                    <div className={styles.formSection}>
                        <h2 className={styles.formSectionTitle}>Emergency Contact</h2>
                        <div className={styles.row}>
                            <div className={styles.field}>
                                <label>Contact Name</label>
                                <input
                                    type="text" name="emergency_name" value={formData.emergencyContact.name}
                                    onChange={handleChange} className={styles.input}
                                />
                            </div>
                            <div className={styles.field}>
                                <label>Relationship</label>
                                <input
                                    type="text" name="emergency_relationship" value={formData.emergencyContact.relationship}
                                    onChange={handleChange} className={styles.input}
                                />
                            </div>
                        </div>
                        <div className={styles.field} style={{ maxWidth: 'calc(50% - 0.75rem)' }}>
                            <label>Emergency Phone</label>
                            <input
                                type="text" name="emergency_phone" value={formData.emergencyContact.phone}
                                onChange={handleChange} className={styles.input}
                            />
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button
                            type="button"
                            onClick={() => navigate('/hr/employees')}
                            className={styles.cancelButton}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={styles.saveButton}
                        >
                            {loading ? 'Creating...' : 'Create Employee'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddEmployee;
