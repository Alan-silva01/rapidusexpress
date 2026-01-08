import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    errorMessage: string;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: '' };
    }

    static getDerivedStateFromError(_: Error): State {
        // Update state so the next render shows the fallback UI.
        return { hasError: true, errorMessage: _.message };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // You can also log the error to an error reporting service
        console.error('ErrorBoundary caught an error', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    background: '#000',
                    color: '#ff4d00',
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'sans-serif',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    padding: '20px',
                    textAlign: 'center',
                }}>
                    <div>
                        <h2>Oops! Something went wrong.</h2>
                        <p>{this.state.errorMessage}</p>
                        <p>Please try refreshing the page or contact support.</p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
