import { useEffect, useState } from 'react';
import { Property } from '../../../types';
import { useFormatting, useAnalytics } from '../../../hooks';
import { Card, CardHeader, CardBody } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import { ExpandButton } from './components/ExpandButton';
import { PropertyDetails } from './PropertyDetails';
import styles from './PropertyCard.module.css';

interface PropertyCardProps {
  property: Property;
  defaultExpanded?: boolean;
}

export const PropertyCard = ({ property, defaultExpanded = false }: PropertyCardProps) => {
  const { formatCurrency } = useFormatting();
  const { logPropertyView } = useAnalytics();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Track property view when card is rendered
  useEffect(() => {
    logPropertyView(property.property_id, property.property_address);
  }, [property.property_id, property.property_address, logPropertyView]);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Card variant="elevated" className={styles.card}>
      <CardHeader>
        <div className={styles.header}>
          <h3 className={styles.owner}>{property.name}</h3>
          <Badge variant="info" size="sm">
            {property.prop_type}
          </Badge>
        </div>
      </CardHeader>

      <CardBody>
        <div className={styles.address}>
          <Icon name="location" size={14} />
          {property.property_address}
          {property.city && `, ${property.city}`}
        </div>

        <div className={styles.summary}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Appraised Value</span>
            <span className={styles.detailValue}>
              {formatCurrency(property.appraised_value)}
            </span>
          </div>

          <div className={styles.expandButtonContainer}>
            <ExpandButton
              isExpanded={isExpanded}
              onToggle={handleToggleExpand}
              size="sm"
            />
          </div>
        </div>

        <PropertyDetails
          property={property}
          isExpanded={isExpanded}
        />
      </CardBody>
    </Card>
  );
};
