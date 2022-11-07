import * as React from 'react';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Container from '@mui/material/Container';

function HomeContent() {
  return (
    <Box>
        <Toolbar />
        <Container>
            <h1>Welcome to the application</h1>
        </Container>
    </Box>
  );
}

export default function Home() {
  return <HomeContent/>;
}
