import { Tile, Grid, Column } from '@carbon/react';

export default function DashboardPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Dashboard</h1>
      <Grid>
        <Column lg={4} md={4} sm={4}>
          <Tile style={{ minHeight: '150px', marginBottom: '1rem' }}>
            <h3>Total Patients</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
              --
            </p>
            <p style={{ color: '#6f6f6f' }}>Placeholder data</p>
          </Tile>
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Tile style={{ minHeight: '150px', marginBottom: '1rem' }}>
            <h3>Total Examinations</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
              --
            </p>
            <p style={{ color: '#6f6f6f' }}>Placeholder data</p>
          </Tile>
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Tile style={{ minHeight: '150px', marginBottom: '1rem' }}>
            <h3>Recent Activity</h3>
            <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '1rem' }}>
              --
            </p>
            <p style={{ color: '#6f6f6f' }}>Placeholder data</p>
          </Tile>
        </Column>
      </Grid>
      <Tile style={{ marginTop: '2rem', padding: '2rem' }}>
        <h2>Welcome to AG Forms</h2>
        <p style={{ marginTop: '1rem' }}>
          This is a placeholder dashboard. Real data and functionality will be implemented later.
        </p>
      </Tile>
    </div>
  );
}

// Made with Bob
