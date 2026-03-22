import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllEmployees } from '../services/employeeService';
import styles from './EmployeeList.module.css';

const EmployeeList = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const navigate = useNavigate();


    const fetchEmployees = async (query = '') => {
        try {
            setLoading(true);
            const { data } = await getAllEmployees({ search: query });
            setEmployees(data.employees || []);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchEmployees(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>Employees</h1>
                <button
                    onClick={() => navigate('/hr/employees/new')}
                    className={styles.addButton}
                >
                    <span>+</span> Add Employee
                </button>
            </div>

            <input
                type="text"
                value={search}
                onChange={handleSearch}
                placeholder="Search by name or ID..."
                className={styles.searchInput}
            />

            {loading ? (
                <div className={styles.loading}>
                    <p>Loading employees...</p>
                </div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr className={styles.tableHeader}>
                                {['ID', 'Name', 'Department', 'Designation', 'Type', 'Action'].map(h => (
                                    <th key={h}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {employees.length > 0 ? (
                                employees.map((emp) => (
                                    <tr key={emp._id} className={styles.tableRow}>
                                        <td>{emp.employeeId}</td>
                                        <td className={styles.empName}>{emp.fullName}</td>
                                        <td>{emp.department?.name || 'N/A'}</td>
                                        <td>{emp.designation}</td>
                                        <td>
                                            <span className={styles.badge}>
                                                {emp.employmentType}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                onClick={() => navigate(`/employees/${emp._id}`)}
                                                className={styles.viewButton}
                                            >
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                                        No employees found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default EmployeeList;