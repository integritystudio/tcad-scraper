import { Property } from '../../../types';
import { useFormatting } from '../../../hooks';
import { Card, CardHeader, CardBody } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Icon } from '../../ui/Icon';
import styles from './PropertyCard.module.css';

interface PropertyCardProps {
  property: Property;
}

export const PropertyCard = ({ property }: PropertyCardProps) => {
  const { formatCurrency } = useFormatting();

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

        <div className={styles.details}>
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Appraised Value</span>
            <span className={styles.detailValue}>
              {formatCurrency(property.appraised_value)}
            </span>
          </div>

          {property.assessed_value && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Assessed Value</span>
              <span className={styles.detailValue}>
                {formatCurrency(property.assessed_value)}
              </span>
            </div>
          )}

          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Property ID</span>
            <span className={`${styles.detailValue} ${styles.mono}`}>
              {property.property_id}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
